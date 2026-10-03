import { describe, expect, it } from 'vitest';
import { ProgressStore, PROGRESS_PREFIX, SELECTION_KEY, completedFromSnapshot } from './progress';

class MemoryStorage {
  data = new Map<string, string>();
  blocked = false;
  quota = false;
  readBlocked = false;
  failRemove: string | null = null;
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(key: string) { if (this.blocked || this.readBlocked) throw new Error('blocked'); return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.quota || this.blocked) throw new Error('quota'); this.data.set(key, value); }
  removeItem(key: string) { if (this.blocked || this.failRemove === key) throw new Error('blocked'); this.data.delete(key); }
}
const create = (storage = new MemoryStorage()) => ({ storage, store: new ProgressStore(storage, new Set(['one', 'two']), new Set(['基本操作'])) });

describe('versioned browser learning records', () => {
  it('starts empty and restores selection, filters, completion dates and hint use without Git state', () => {
    const { store, storage } = create();
    expect(store.snapshot().completed.size).toBe(0);
    expect(store.complete('one', 123)).toBeNull();
    expect(store.reveal('one', 2)).toBeNull();
    expect(store.reveal('one', 1)).toBeNull();
    expect(store.select({ lastId: 'one', category: '基本操作', search: '日本語' })).toBeNull();
    const restored = create(storage).store.snapshot();
    expect(restored.completed.get('one')).toBe(123);
    expect(restored.hints.get('one')).toBe(2);
    expect(restored).toMatchObject({ lastId: 'one', category: '基本操作', search: '日本語', warnings: [] });
    expect([...storage.data.values()].join()).not.toMatch(/workingDirectory|commits|history/);
  });
  it('keeps independent simultaneous tab completions and selection changes', () => {
    const { store: a, storage } = create();
    const b = create(storage).store;
    a.snapshot(); b.snapshot();
    a.complete('one', 1); b.complete('two', 2);
    a.select({ lastId: 'one', category: 'all', search: '' });
    b.reveal('one', 3);
    expect([...a.snapshot().completed.keys()]).toEqual(['one', 'two']);
    b.clear('one');
    a.select({ lastId: 'two', category: 'all', search: 'status' });
    expect([...a.snapshot().completed.keys()]).toEqual(['two']);
  });
  it('deletes one exercise separately from selection, then clears all app keys only', () => {
    const { store, storage } = create();
    storage.setItem('unrelated', 'keep');
    storage.setItem(`${PROGRESS_PREFIX}complete:deleted-lesson`, '{}');
    store.complete('one'); store.complete('two'); store.reveal('one', 4);
    store.select({ lastId: 'one', category: 'all', search: '' });
    expect(store.clear('one')).toBeNull();
    expect(store.snapshot().lastId).toBe('one');
    expect(store.snapshot().hints.has('one')).toBe(false);
    expect([...store.snapshot().completed.keys()]).toEqual(['two']);
    expect(store.clear()).toBeNull();
    expect([...storage.data]).toEqual([['unrelated', 'keep']]);
  });
  it.each(['{', 'null', '[]', '"text"', '{"version":2}', 'x'.repeat(10001)])('ignores malformed or unsupported data: %s', raw => {
    const { store, storage } = create();
    storage.setItem(SELECTION_KEY, raw);
    storage.setItem(`${PROGRESS_PREFIX}complete:one`, raw);
    const snapshot = store.snapshot();
    expect(snapshot.lastId).toBeNull(); expect(snapshot.completed.size).toBe(0);
    expect(snapshot.warnings.length).toBeGreaterThan(0);
  });
  it('rejects invalid ids, filters, oversized search and prototype keys', () => {
    const { store, storage } = create();
    storage.setItem(SELECTION_KEY, JSON.stringify({ version: 1, lastId: '__proto__', category: 'invalid', search: 'x'.repeat(513) }));
    storage.setItem(`${PROGRESS_PREFIX}complete:one`, JSON.stringify({ version: 1, id: 'two', completedAt: 1 }));
    expect(store.snapshot()).toMatchObject({ lastId: null, category: 'all', search: '' });
    expect(store.snapshot().completed.size).toBe(0);
    expect(store.complete('constructor')).toBeTruthy();
    expect(store.select({ lastId: 'bad', category: 'all', search: '' })).toBeTruthy();
    expect(store.select({ lastId: 'one', category: 'bad', search: '' })).toBeTruthy();
  });
  it.each([-1, 1.5, '1', null, Number.MAX_VALUE])('rejects invalid timestamps: %s', completedAt => {
    const { store, storage } = create();
    storage.setItem(`${PROGRESS_PREFIX}complete:one`, JSON.stringify({ version: 1, id: 'one', completedAt }));
    expect(store.snapshot().completed.size).toBe(0);
    expect(store.snapshot().warnings.length).toBeGreaterThan(0);
  });
  it.each([0, 5, 1.5, '2', null])('rejects invalid hint depth: %s', level => {
    const { store, storage } = create();
    storage.setItem(`${PROGRESS_PREFIX}hint:one`, JSON.stringify({ version: 1, id: 'one', level }));
    expect(store.snapshot().hints.size).toBe(0);
  });
  it('keeps future data intact until explicit deletion', () => {
    const { store, storage } = create();
    const future = '{"version":2,"important":"keep"}';
    storage.setItem(SELECTION_KEY, future);
    expect(store.select({ lastId: 'one', category: 'all', search: '' })).toContain('未対応');
    expect(storage.getItem(SELECTION_KEY)).toBe(future);
    store.clear();
    expect(store.select({ lastId: 'one', category: 'all', search: '' })).toBeNull();
  });
  it('handles denied access and quota failure, and supports retry', () => {
    const { store, storage } = create();
    storage.quota = true;
    expect(store.complete('one', 10)).toContain('保存できません');
    storage.quota = false;
    expect(store.complete('one', 10)).toBeNull();
    storage.blocked = true;
    expect(store.snapshot().warnings.length).toBeGreaterThan(0);
    expect(store.clear()).toContain('削除できません');
  });
  it('retains known completions on a failed read, then reflects verified deletion and rejects corrupt records', () => {
    const { store, storage } = create();
    store.complete('one', 10);
    const previous = new Set(store.snapshot().completed.keys());
    storage.readBlocked = true;
    const denied = store.snapshot();
    expect(denied.unreadableCompletions).toEqual(new Set(['one', 'two']));
    expect(completedFromSnapshot(denied, previous, ['two'])).toEqual(new Set(['one', 'two']));
    storage.readBlocked = false;
    store.clear('one');
    expect(completedFromSnapshot(store.snapshot(), previous, [])).toEqual(new Set());
    storage.setItem(`${PROGRESS_PREFIX}complete:one`, '{');
    expect(completedFromSnapshot(store.snapshot(), previous, [])).toEqual(new Set());
  });
  it.each(['current', 'all'])('restores already removed records when %s deletion fails, then retries without affecting unrelated storage', scope => {
    const { store, storage } = create();
    store.complete('one', 10); store.reveal('one', 4); store.complete('two', 20);
    store.select({ lastId: 'one', category: 'all', search: '' });
    storage.setItem('unrelated', 'keep');
    const before = new Map(storage.data);
    storage.failRemove = `${PROGRESS_PREFIX}hint:one`;
    expect(store.clear(scope === 'current' ? 'one' : undefined)).toContain('削除できません');
    expect(storage.data).toEqual(before);
    storage.failRemove = null;
    expect(store.clear(scope === 'current' ? 'one' : undefined)).toBeNull();
    expect(store.snapshot().completed.has('one')).toBe(false);
    expect(store.snapshot().completed.has('two')).toBe(scope === 'current');
    expect(storage.getItem('unrelated')).toBe('keep');
  });
  it('does not remove anything if the deletion preflight cannot read records', () => {
    const { store, storage } = create();
    store.complete('one', 10); store.reveal('one', 4);
    const before = new Map(storage.data);
    storage.readBlocked = true;
    expect(store.clear('one')).toContain('削除できません');
    expect(storage.data).toEqual(before);
  });
  it('reports partial deletion if the storage permission also prevents rollback', () => {
    const { store, storage } = create();
    store.complete('one', 10); store.reveal('one', 4);
    storage.failRemove = `${PROGRESS_PREFIX}hint:one`;
    storage.quota = true;
    expect(store.clear('one')).toContain('一部を戻せませんでした');
    storage.quota = false; storage.failRemove = null;
    expect(store.clear('one')).toBeNull();
  });
  it('does not overwrite a newer completion from another tab while rolling back deletion', () => {
    const { store, storage } = create();
    store.complete('one', 10); store.reveal('one', 4);
    const remove = storage.removeItem.bind(storage);
    storage.removeItem = key => {
      if (key.endsWith('hint:one')) {
        storage.setItem(`${PROGRESS_PREFIX}complete:one`, JSON.stringify({ version: 1, id: 'one', completedAt: 99 }));
        throw new Error('concurrent failure');
      }
      remove(key);
    };
    expect(store.clear('one')).toContain('削除できません');
    expect(store.snapshot().completed.get('one')).toBe(99);
  });
});
