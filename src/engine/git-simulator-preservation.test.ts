import { describe, expect, it } from 'vitest';
import { GitEngine } from './git-simulator';
import { advancedScenarios } from './advanced-scenarios';
import { operationScenarios } from './operation-scenarios';
import { headTree } from './git-state';

function mergeFixture(diverged = false) {
  const engine = new GitEngine();
  for (const command of ['echo "base" > app.ts', 'git add .', 'git commit -m "Initial"', 'git switch -c feature', 'echo "feature" > feature.ts', 'git add .', 'git commit -m "Feature"', 'git switch main']) {
    expect(engine.execute(command).success, command).toBe(true);
  }
  if (diverged) for (const command of ['echo "docs" > README.md', 'git add .', 'git commit -m "Docs"']) expect(engine.execute(command).success).toBe(true);
  return engine;
}

describe('Preserving work outside the changed snapshots', () => {
  it.each([false, true])('merge preserves untracked files without committing them (diverged: %s)', diverged => {
    const engine = mergeFixture(diverged);
    engine.touch('notes.txt', 'private memo');
    expect(engine.execute('git merge feature').success).toBe(true);
    expect(engine.getState().workingDirectory['notes.txt']).toBe('private memo');
    expect(headTree(engine.getState())['notes.txt']).toBeUndefined();
  });

  it.each([false, true])('merge refuses to overwrite untracked files (diverged: %s)', diverged => {
    const engine = mergeFixture(diverged);
    engine.touch('feature.ts', 'untracked draft');
    const before = engine.getState();
    expect(engine.execute('git merge feature').success).toBe(false);
    expect(engine.getState()).toEqual(before);
  });

  it.each(['git sparse-checkout set src', 'git sparse-checkout init', 'git sparse-checkout disable'])('%s preserves untracked files outside the sparse scope', command => {
    const scenario = advancedScenarios.find(s => s.id === 'advanced-sparse')!;
    const engine = new GitEngine(scenario.initialState);
    engine.touch('scratch/notes.txt', 'memo');
    expect(engine.execute(command).success).toBe(true);
    expect(engine.getState().workingDirectory['scratch/notes.txt']).toBe('memo');
    expect(headTree(engine.getState())['scratch/notes.txt']).toBeUndefined();
  });

  it('bisect preserves untracked files through candidate changes and reset', () => {
    const engine = new GitEngine(advancedScenarios.find(s => s.id === 'advanced-bisect-find')!.initialState);
    engine.touch('notes.txt', 'memo');
    for (const command of ['git bisect start', 'git bisect bad c5', 'git bisect good c1']) expect(engine.execute(command).success).toBe(true);
    expect(engine.getState().workingDirectory['notes.txt']).toBe('memo');
    engine.touch('notes.txt', 'updated memo');
    expect(engine.execute('git bisect reset').success).toBe(true);
    expect(engine.getState().workingDirectory['notes.txt']).toBe('updated memo');
  });

  it('skipping a conflicted replay preserves unrelated untracked files', () => {
    const engine = new GitEngine(operationScenarios[0].initialState);
    engine.touch('notes.txt', 'memo');
    expect(engine.execute('git rebase main').success).toBe(false);
    expect(engine.execute('git rebase --skip').success).toBe(true);
    expect(engine.getState().workingDirectory['notes.txt']).toBe('memo');
    expect(headTree(engine.getState())['notes.txt']).toBeUndefined();
  });

  it('LFS tracking appends attributes while retaining unrelated rules', () => {
    const engine = new GitEngine();
    engine.touch('.gitattributes', '*.txt text eol=lf\n');
    engine.execute('git lfs install');
    expect(engine.execute('git lfs track "*.png"').success).toBe(true);
    const attributes = engine.getState().workingDirectory['.gitattributes'];
    expect(attributes).toContain('*.txt text eol=lf\n');
    expect(attributes).toContain('*.png filter=lfs diff=lfs merge=lfs -text\n');
    engine.execute('git lfs track "*.png"');
    expect(engine.getState().workingDirectory['.gitattributes']).toBe(attributes);
  });

  it('stash -u leaves ignored files in place while saving other untracked files', () => {
    const engine = mergeFixture();
    engine.touch('.gitignore', 'build/');
    engine.execute('git add .gitignore');
    engine.execute('git commit -m "Ignore output"');
    engine.touch('build/output.txt', 'generated');
    engine.touch('notes.txt', 'memo');
    expect(engine.execute('git stash push -u').success).toBe(true);
    expect(engine.getState().workingDirectory['build/output.txt']).toBe('generated');
    expect(engine.getState().stash[0].workingDirectory['build/output.txt']).toBeUndefined();
    expect(engine.getState().workingDirectory['notes.txt']).toBeUndefined();
    expect(engine.execute('git stash pop').success).toBe(true);
    expect(engine.getState().workingDirectory['notes.txt']).toBe('memo');
    expect(engine.getState().workingDirectory['build/output.txt']).toBe('generated');
  });

  it('stash does not mistake excluded sparse files for deleted tracked files', () => {
    const engine = new GitEngine(advancedScenarios.find(s => s.id === 'advanced-sparse')!.initialState);
    engine.execute('git sparse-checkout set src');
    const before = engine.getState();
    expect(engine.execute('git stash push').success).toBe(false);
    expect(engine.getState()).toEqual(before);
    engine.touch('src/app.ts', 'draft');
    expect(engine.execute('git stash push').success).toBe(true);
    expect(engine.execute('git stash pop').success).toBe(true);
    expect(engine.getState().workingDirectory['src/app.ts']).toBe('draft');
    expect(headTree(engine.getState())['tests/spec.ts']).toBe('test');
    expect(engine.getState().stash).toEqual([]);
  });

  it('aborting a rebase retains untracked files created while resolving a conflict', () => {
    const engine = new GitEngine(operationScenarios[0].initialState);
    expect(engine.execute('git rebase main').success).toBe(false);
    engine.touch('notes.txt', 'new memo');
    expect(engine.execute('git rebase --abort').success).toBe(true);
    expect(engine.getState().workingDirectory['notes.txt']).toBe('new memo');
    expect(headTree(engine.getState())['notes.txt']).toBeUndefined();
  });

  it('aborting a merge retains untracked files created while resolving a conflict', () => {
    const engine = mergeFixture(true);
    engine.execute('echo "main" > app.ts');
    engine.execute('git add app.ts');
    engine.execute('git commit -m "Main"');
    engine.execute('git switch feature');
    engine.execute('echo "feature" > app.ts');
    engine.execute('git add app.ts');
    engine.execute('git commit -m "Feature app"');
    engine.execute('git switch main');
    expect(engine.execute('git merge feature').success).toBe(false);
    engine.touch('notes.txt', 'new memo');
    expect(engine.execute('git merge --abort').success).toBe(true);
    expect(engine.getState().workingDirectory['notes.txt']).toBe('new memo');
    expect(headTree(engine.getState())['notes.txt']).toBeUndefined();
  });

  it('skip removes an operation-created delete/modify conflict file but keeps unrelated notes', () => {
    const engine = mergeFixture();
    engine.execute('git switch feature');
    engine.execute('echo "changed" > app.ts');
    engine.execute('git add app.ts');
    engine.execute('git commit -m "Edit app"');
    engine.execute('git switch main');
    engine.execute('git rm app.ts');
    engine.execute('git commit -m "Delete app"');
    expect(engine.execute('git cherry-pick feature').success).toBe(false);
    engine.touch('notes.txt', 'memo');
    expect(engine.execute('git cherry-pick --skip').success).toBe(true);
    expect(engine.getState().workingDirectory['app.ts']).toBeUndefined();
    expect(engine.getState().workingDirectory['notes.txt']).toBe('memo');
  });
});
