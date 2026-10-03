/** Only learning records are persisted; GitState and terminal contents never are. */
export const PROGRESS_PREFIX = 'git-learning:v1:';
export const SELECTION_KEY = `${PROGRESS_PREFIX}selection`;
export interface Selection { lastId: string | null; category: string; search: string }
export interface ProgressSnapshot extends Selection {
  completed: Map<string, number>;
  hints: Map<string, number>;
  unreadableCompletions: Set<string>;
  warnings: string[];
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
const emptySelection: Selection = { lastId: null, category: 'all', search: '' };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
class StorageReadError extends Error {}

/** Retain known records only when storage could not be read, never after a verified deletion. */
export function completedFromSnapshot(snapshot: ProgressSnapshot, previous: ReadonlySet<string>, unsaved: Iterable<string>): Set<string> {
  return new Set([...snapshot.completed.keys(), ...[...previous].filter(id => snapshot.unreadableCompletions.has(id)), ...unsaved]);
}

export class ProgressStore {
  constructor(private storage: StoragePort, private ids: Set<string>, private categories: Set<string>) {}
  private read(key: string): Record<string, unknown> | null {
    let raw: string | null;
    try { raw = this.storage.getItem(key); }
    catch { throw new StorageReadError('保存領域を読み取れません。'); }
    if (raw === null) return null;
    if (raw.length > 10000) throw new Error('保存データが大きすぎます。');
    const value: unknown = JSON.parse(raw);
    if (!object(value)) throw new Error('保存データの形式が壊れています。');
    if (value.version !== 1) throw new Error('未対応の保存バージョンです。');
    return value;
  }
  snapshot(): ProgressSnapshot {
    const snapshot: ProgressSnapshot = { ...emptySelection, completed: new Map(), hints: new Map(), unreadableCompletions: new Set(), warnings: [] };
    const safely = (read: () => void, completionId?: string) => {
      try { read(); } catch (error) {
        if (error instanceof StorageReadError) {
          if (completionId) snapshot.unreadableCompletions.add(completionId);
          snapshot.warnings.push('保存領域を読み取れません。読み取れない完了記録はこの画面の表示を保持しています。保存の許可を確認して再試行してください。');
        } else snapshot.warnings.push('保存データを一部読み込めません。壊れたデータ・未対応バージョン・保存へのアクセス制限を確認し、必要なら保存記録を削除してください。');
      }
    };
    safely(() => {
      const data = this.read(SELECTION_KEY);
      if (!data) return;
      if (data.lastId !== null && (typeof data.lastId !== 'string' || !this.ids.has(data.lastId))) snapshot.warnings.push('保存された演習IDが無効です。演習を選び直してください。');
      else snapshot.lastId = data.lastId as string | null;
      if (typeof data.category === 'string' && (data.category === 'all' || this.categories.has(data.category))) snapshot.category = data.category;
      if (typeof data.search === 'string' && data.search.length <= 512) snapshot.search = data.search;
    });
    for (const id of this.ids) {
      safely(() => {
        const data = this.read(`${PROGRESS_PREFIX}complete:${id}`);
        if (!data) return;
        if (data.id !== id || typeof data.completedAt !== 'number' || !Number.isSafeInteger(data.completedAt) || data.completedAt < 0) throw new Error('Invalid completion');
        snapshot.completed.set(id, data.completedAt);
      }, id);
      safely(() => {
        const data = this.read(`${PROGRESS_PREFIX}hint:${id}`);
        if (!data) return;
        if (data.id !== id || !Number.isInteger(data.level) || Number(data.level) < 1 || Number(data.level) > 4) throw new Error('Invalid hint');
        snapshot.hints.set(id, Number(data.level));
      });
    }
    snapshot.warnings = [...new Set(snapshot.warnings)];
    return snapshot;
  }
  private write(key: string, data: Record<string, unknown>): string | null {
    try {
      // A later app's format must not be silently overwritten by this version.
      const raw = this.storage.getItem(key);
      if (raw) {
        let value: unknown;
        try { value = JSON.parse(raw); } catch { /* Explicit retry repairs invalid JSON. */ }
        if (object(value) && value.version !== 1) return '未対応の保存バージョンです。保存記録を削除してから保存してください。';
      }
      this.storage.setItem(key, JSON.stringify({ version: 1, ...data }));
      return null;
    } catch {
      return 'ブラウザに保存できません。容量や保存の許可を確認し、保存を再試行してください。この画面では学習を続けられます。';
    }
  }
  select(selection: Selection): string | null {
    if ((selection.lastId !== null && !this.ids.has(selection.lastId)) || (selection.category !== 'all' && !this.categories.has(selection.category)) || selection.search.length > 512) return '演習選択の保存内容が無効です。';
    return this.write(SELECTION_KEY, { ...selection });
  }
  complete(id: string, completedAt = Date.now()): string | null {
    if (!this.ids.has(id) || !Number.isSafeInteger(completedAt) || completedAt < 0) return '完了記録が無効です。';
    // One key per exercise: simultaneous completions in other tabs never overwrite each other.
    return this.write(`${PROGRESS_PREFIX}complete:${id}`, { id, completedAt });
  }
  reveal(id: string, level: number): string | null {
    if (!this.ids.has(id) || !Number.isInteger(level) || level < 1 || level > 4) return 'ヒント記録が無効です。';
    try {
      const previous = this.read(`${PROGRESS_PREFIX}hint:${id}`);
      if (previous?.id === id && Number.isInteger(previous.level) && Number(previous.level) >= 1 && Number(previous.level) <= 4) level = Math.max(level, Number(previous.level));
    } catch { /* Invalid records can be repaired; write still protects future versions. */ }
    return this.write(`${PROGRESS_PREFIX}hint:${id}`, { id, level });
  }
  clear(id?: string): string | null {
    const removed = new Map<string, string>();
    try {
      if (id && !this.ids.has(id)) return '演習IDが無効です。';
      const keys = id ? [`${PROGRESS_PREFIX}complete:${id}`, `${PROGRESS_PREFIX}hint:${id}`] :
        Array.from({ length: this.storage.length }, (_, i) => this.storage.key(i)).filter((key): key is string => !!key?.startsWith(PROGRESS_PREFIX));
      // Read all selected records before deleting any, so a denied read cannot cause a partial deletion.
      const records = keys.map(key => [key, this.storage.getItem(key)] as const);
      for (const [key, value] of records) {
        if (value === null) continue;
        this.storage.removeItem(key);
        removed.set(key, value);
      }
      return null;
    } catch {
      let restoreFailed = false;
      for (const [key, value] of removed) {
        try {
          // Do not replace a newer record written by another tab during this operation.
          if (this.storage.getItem(key) === null) this.storage.setItem(key, value);
        } catch { restoreFailed = true; }
      }
      return restoreFailed
        ? '保存記録の削除が途中で失敗し、一部を戻せませんでした。削除済みの記録がある可能性があります。保存の許可を確認して、もう一度削除してください。'
        : '保存記録を削除できません。保存の許可を確認して、もう一度削除してください。';
    }
  }
}
