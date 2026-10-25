import { describe, expect, it } from 'vitest';
import { GitEngine } from './git-simulator';
import { commandHelp } from './command-input';

function fixture() {
  const engine = new GitEngine();
  for (const command of ['echo "base" > src/app.ts', 'echo "ignored.log" > .gitignore', 'git add .', 'git commit -m "Root"', 'echo "draft" > notes.txt', 'echo "draft" > src/new.ts', 'echo "draft" > src/deeper/extra.txt', 'echo "draft" > scratch/a.txt', 'echo "ignored" > ignored.log']) expect(engine.execute(command).success, command).toBe(true);
  return engine;
}
describe('read-only clean preview', () => {
  it('previews untracked nonignored files and does not enter untracked directories by default', () => {
    const engine = fixture();
    const before = engine.getState();
    for (const command of ['git clean -n', 'git clean --dry-run', 'git clean -n --']) {
      const result = engine.execute(command);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Would remove "notes.txt"');
      expect(result.message).toContain('Would remove "src/new.ts"');
      for (const excluded of ['src/app.ts', '.gitignore', 'ignored.log', 'scratch/a.txt', 'src/deeper/extra.txt']) expect(result.message).not.toContain(excluded);
      expect(engine.getState()).toEqual(before);
    }
  });
  it('includes nested files with -d while preserving ignored files and every state field', () => {
    const engine = fixture();
    const before = engine.getState();
    for (const command of ['git clean -nd', 'git clean -dn', 'git clean -n -d', 'git clean --dry-run -d']) {
      const result = engine.execute(command);
      expect(result.success).toBe(true);
      for (const path of ['notes.txt', 'src/new.ts', 'scratch/a.txt', 'src/deeper/extra.txt']) expect(result.message).toContain(JSON.stringify(path));
      expect(result.message).not.toContain('ignored.log');
      expect(engine.getState()).toEqual(before);
    }
  });
  it('refuses real deletion and unsupported selectors before changing state', () => {
    const engine = fixture();
    const before = engine.getState();
    for (const command of ['git clean', 'git clean -d', 'git clean -f', 'git clean -n -f', 'git clean -n -x', 'git clean -n notes.txt', 'git clean -- -n', 'git clean -n -- notes.txt']) {
      expect(engine.execute(command).success, command).toBe(false);
      expect(engine.getState()).toEqual(before);
    }
    expect(commandHelp('clean')).toContain('確認のみ');
  });
  it('does not call ordinary conflict paths or virtual .git metadata removable', () => {
    const engine = new GitEngine();
    const state = engine.getState();
    state.workingDirectory = { 'conflict.txt': 'pending', '.git/config': 'metadata', 'module/readme': 'module data', 'nested/.git/config': 'metadata', 'nested/data.txt': 'nested data' };
    state.submodules = { module: { url: 'mock://module', commitId: 'module-commit', initialized: true } };
    state.unmergedPaths = ['conflict.txt'];
    engine.loadState(state);
    const before = engine.getState();
    expect(engine.execute('git clean -nd').message).toContain('削除候補はありません');
    expect(engine.getState()).toEqual(before);
  });
});
