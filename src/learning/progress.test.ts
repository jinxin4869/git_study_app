import { describe, expect, it } from 'vitest';
import { ProgressStore, PROGRESS_PREFIX, SELECTION_KEY } from './progress';

class MemoryStorage {
  data = new Map<string, string>();
  blocked = false;
  quota = false;
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(key: string) { if (this.blocked) throw new Error('blocked'); return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.quota || this.blocked) throw new Error('quota'); this.data.set(key, value); }
  removeItem(key: string) { if (this.blocked) throw new Error('blocked'); this.data.delete(key); }
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
});
