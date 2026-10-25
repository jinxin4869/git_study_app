import type { GitState, CommandResult } from '@/types/git';
import type { TerminalLine } from '@/components/terminal-output';
import { cloneGitData } from '@/engine/git-state';
import { PROGRESS_PREFIX, SELECTION_KEY } from './progress';

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
export interface SavedSession {
  version: 1; scenarioId: string | null; state: GitState;
  output: TerminalLine[]; history: string[]; hintLevel: number;
  lastAttempt: { command: string; result: Pick<CommandResult, 'success' | 'message'> & { stateChanged?: boolean } } | null;
}
export interface LearningBackup { format: 'git-learning-backup'; version: 1; records: [string, string][] }
export const MAX_BACKUP_BYTES = 5_000_000;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 500_000;
const number = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 10000 && value.every(text);
const map = (value: unknown, check: (item: unknown, key: string) => boolean): boolean => object(value) && Object.keys(value).length <= 10000 && Object.entries(value).every(([key, item]) => check(item, key));
const tree = (value: unknown) => map(value, text);
const change = (value: unknown) => object(value) && text(value.path) && ['unmodified', 'modified', 'staged', 'deleted'].includes(String(value.status)) && (value.content === undefined || text(value.content));
const index = (value: unknown) => map(value, (entry, key) => change(entry) && (entry as Record<string, unknown>).path === key);
const optional = (value: Record<string, unknown>, key: string, check: (item: unknown) => boolean) => value[key] === undefined || check(value[key]);
const stateFields = new Set(['commits','branches','HEAD','index','workingDirectory','detachedHead','stash','remotes','remoteBranches','mockServers','unmergedPaths','patchSession','worktrees','activeWorktree','submodules','lfs','sparseCheckout','bisect','lastBisectFound','operation','config','upstreams','tags','reflog','github','pendingMerge']);
function validState(value: unknown, depth = 0): value is GitState {
  if (depth > 4 || !object(value) || Object.keys(value).some(key => !stateFields.has(key))) return false;
  const commit = (item: unknown, key: string) => object(item) && item.id === key && text(item.message) && strings(item.parents) && number(item.timestamp) && text(item.author) && tree(item.tree) && Array.isArray(item.changes) && item.changes.every(change);
  if (!map(value.commits, commit) || !tree(value.branches) || !object(value.HEAD) || !['branch','commit'].includes(String(value.HEAD.type)) || !text(value.HEAD.value) || !index(value.index) || !tree(value.workingDirectory) || typeof value.detachedHead !== 'boolean' || !tree(value.remotes) || !tree(value.remoteBranches)) return false;
  const commits = value.commits as Record<string, { parents: string[] }>;
  // Both dangling parents and cycles can hang history/graph traversal.
  const done = new Set<string>();
  const visiting = new Set<string>();
  const pending: [string, boolean][] = [];
  for (const id of Object.keys(commits)) {
    pending.push([id, false]);
    while (pending.length) {
      const [current, exiting] = pending.pop()!;
      if (exiting) { visiting.delete(current); done.add(current); continue; }
      if (done.has(current)) continue;
      if (!commits[current] || visiting.has(current)) return false;
      visiting.add(current); pending.push([current, true]);
      for (const parent of commits[current].parents) pending.push([parent, false]);
    }
  }
  const reference = (id: unknown) => text(id) && (id === '' || Object.hasOwn(commits, id));
  if (!map(value.branches, reference) || !map(value.remoteBranches, reference)) return false;
  if (value.HEAD.type === 'branch' ? !Object.hasOwn(value.branches as object, value.HEAD.value) : !reference(value.HEAD.value)) return false;
  const server = (item: unknown) => object(item) && tree(item.branches) && map(item.commits, commit) && optional(item, 'tags', tags);
  const tags = (item: unknown) => map(item, tag => object(tag) && text(tag.commitId) && optional(tag, 'message', text));
  if (!map(value.mockServers, server) || !Array.isArray(value.stash) || !value.stash.every(item => object(item) && text(item.id) && text(item.message) && number(item.timestamp) && index(item.index) && tree(item.workingDirectory) && optional(item,'baseTree',tree))) return false;
  if (!optional(value,'unmergedPaths',strings) || !optional(value,'sparseCheckout',strings) || !optional(value,'config',tree) || !optional(value,'upstreams',tree) || !optional(value,'tags',tags) || !optional(value,'activeWorktree',text) || !optional(value,'lastBisectFound',text)) return false;
  if (!optional(value,'reflog', item => Array.isArray(item) && item.every(entry => object(entry) && text(entry.id) && text(entry.command)))) return false;
  if (!optional(value,'pendingMerge', item => object(item) && reference(item.targetId) && tree(item.workingDirectory) && index(item.index))) return false;
  if (!optional(value,'operation', item => object(item) && ['rebase','cherry-pick','revert'].includes(String(item.kind)) && validState(item.original,depth+1) && strings(item.remaining) && item.remaining.every(reference) && optional(item,'todo',text) && optional(item,'awaiting', x => ['todo','edit','reword'].includes(String(x))) && optional(item,'actions', x => map(x, action => ['pick','reword','edit','squash','fixup','drop'].includes(String(action)))) && optional(item,'current', x => object(x) && reference(x.id) && text(x.message) && optional(x,'committed',v=>typeof v==='boolean') && optional(x,'amend',v=>typeof v==='boolean')))) return false;
  if (!optional(value,'bisect', item => object(item) && validState(item.original,depth+1) && ['good','bad','found'].every(key => optional(item,key,reference)))) return false;
  if (!optional(value,'patchSession', item => object(item) && text(item.path) && number(item.cursor) && Array.isArray(item.chunks) && item.cursor < item.chunks.length && item.chunks.every(chunk => object(chunk) && text(chunk.before) && text(chunk.after) && typeof chunk.changed === 'boolean' && optional(chunk,'selected',x=>typeof x==='boolean')))) return false;
  if (!optional(value,'worktrees', item => map(item, entry => object(entry) && text(entry.branch) && tree(entry.workingDirectory) && index(entry.index)))) return false;
  if (!optional(value,'submodules', item => map(item, entry => object(entry) && text(entry.url) && text(entry.commitId) && typeof entry.initialized === 'boolean'))) return false;
  if (!optional(value,'lfs', item => object(item) && typeof item.installed === 'boolean' && strings(item.patterns))) return false;
  if (!optional(value,'github', item => object(item) && typeof item.requireReview === 'boolean' && typeof item.requireCI === 'boolean' && map(item.pullRequests, pr => object(pr) && number(pr.number) && ['title','body','base','head','headCommit'].every(key => text(pr[key])) && ['open','merged','closed'].includes(String(pr.status)) && optional(pr,'review', x=>object(x) && text(x.commitId) && ['approved','changes_requested'].includes(String(x.result)) && text(x.body)) && optional(pr,'checks',x=>object(x) && text(x.commitId) && ['success','failure'].includes(String(x.status)))))) return false;
  return true;
}
function parseJson(raw: string): unknown {
  if (raw.length > MAX_BACKUP_BYTES || new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error('保存データは5MB以下にしてください。');
  const data: unknown = JSON.parse(raw);
  // Limit nesting before invoking any recursive normalizer or validator.
  const queue: [unknown, number][] = [[data,0]];
  let nodes = 0;
  while (queue.length) {
    const [item, depth] = queue.pop()!;
    if (++nodes > 200000 || depth > 40) throw new Error('保存データの構造が複雑すぎます。');
    if (item && typeof item === 'object') for (const child of Object.values(item)) queue.push([child,depth+1]);
  }
  return data;
}
export const sessionKey = (id: string | null) => `${PROGRESS_PREFIX}session:${id ?? 'free'}`;
export function parseSession(raw: string, ids: Set<string>): SavedSession {
  const data = parseJson(raw);
  if (!object(data) || data.version !== 1 || (data.scenarioId !== null && (!text(data.scenarioId) || !ids.has(data.scenarioId))) || !validState(data.state) || !strings(data.history) || !number(data.hintLevel) || data.hintLevel > 4 || !Array.isArray(data.output) || data.output.length > 10000 || !data.output.every(line => object(line) && ['command','success','error','info'].includes(String(line.type)) && text(line.content)) || !(data.lastAttempt === null || (object(data.lastAttempt) && text(data.lastAttempt.command) && object(data.lastAttempt.result) && typeof data.lastAttempt.result.success === 'boolean' && text(data.lastAttempt.result.message) && optional(data.lastAttempt.result,'stateChanged',value=>typeof value==='boolean')))) throw new Error('途中状態の形式・演習ID・参照が不正か、未対応のバージョンです。');
  return cloneGitData(data) as unknown as SavedSession;
}
export function saveSession(storage: StoragePort, session: SavedSession, ids: Set<string>) {
  const raw = JSON.stringify(session);
  parseSession(raw,ids);
  const old = storage.getItem(sessionKey(session.scenarioId));
  if (old) parseSession(old,ids); // Do not replace a newer/unknown format.
  storage.setItem(sessionKey(session.scenarioId), raw);
}
function validateRecord(key: string, raw: string, ids: Set<string>, categories: Set<string>) {
  const data = parseJson(raw);
  if (!object(data) || data.version !== 1) throw new Error('未対応の保存形式です。');
  if (key === SELECTION_KEY) {
    if (!(data.lastId === null || (text(data.lastId) && ids.has(data.lastId))) || !text(data.category) || !(data.category === 'all' || categories.has(data.category)) || !text(data.search) || data.search.length > 512) throw new Error('演習選択が不正です。');
  } else if (key.startsWith(`${PROGRESS_PREFIX}session:`)) {
    const session = parseSession(raw,ids);
    if (key !== sessionKey(session.scenarioId)) throw new Error('途中状態のキーが一致しません。');
  } else {
    const kind = key.startsWith(`${PROGRESS_PREFIX}complete:`) ? 'complete' : key.startsWith(`${PROGRESS_PREFIX}hint:`) ? 'hint' : null;
    const id = kind ? key.slice(`${PROGRESS_PREFIX}${kind}:`.length) : '';
    if (!kind || !ids.has(id) || data.id !== id || (kind === 'complete' ? !number(data.completedAt) : !number(data.level) || data.level < 1 || data.level > 4)) throw new Error('進捗記録が不正です。');
  }
}
export function readBackup(raw: string, ids: Set<string>, categories: Set<string>): LearningBackup {
  const data = parseJson(raw);
  if (!object(data) || data.format !== 'git-learning-backup' || data.version !== 1 || !Array.isArray(data.records) || data.records.length > ids.size * 3 + 2) throw new Error('バックアップの形式・バージョンが不正です。');
  const keys = new Set<string>();
  for (const entry of data.records) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || typeof entry[1] !== 'string' || keys.has(entry[0])) throw new Error('バックアップのキーが重複または不正です。');
    validateRecord(entry[0],entry[1],ids,categories); keys.add(entry[0]);
  }
  return data as unknown as LearningBackup;
}
export function exportBackup(storage: StoragePort, ids: Set<string>, categories: Set<string>): string {
  const records: [string,string][] = [];
  for (let i=0; i<storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PROGRESS_PREFIX)) continue;
    const raw = storage.getItem(key);
    if (raw !== null) records.push([key,raw]);
  }
  const raw = JSON.stringify({format:'git-learning-backup',version:1,records});
  readBackup(raw,ids,categories);
  return raw;
}
export function importBackup(storage: StoragePort, backup: LearningBackup, ids: Set<string>, categories: Set<string>) {
  const checked = readBackup(JSON.stringify(backup),ids,categories);
  const old = checked.records.map(([key]) => [key,storage.getItem(key)] as const);
  for (const [key,raw] of old) if (raw !== null) validateRecord(key,raw,ids,categories);
  const written = new Set<string>();
  const imported = new Map(checked.records);
  try { for (const [key,raw] of checked.records) { storage.setItem(key,raw); written.add(key); } }
  catch {
    let restoreFailed = false;
    for (const [key,raw] of old) {
      if (!written.has(key)) continue;
      try {
        // Keep a newer value written by another tab during this import.
        if (storage.getItem(key) !== imported.get(key)) continue;
        if (raw === null) storage.removeItem(key); else storage.setItem(key,raw);
      } catch { restoreFailed = true; }
    }
    throw new Error(restoreFailed ? '取り込みに失敗し、一部を戻せませんでした。バックアップを保管して保存設定を確認してください。' : '取り込みに失敗しました。書き込んだ記録を元の記録へ戻しました（別タブの更新は保持）。容量・保存設定を確認してください。');
  }
}
