import { describe, expect, it } from 'vitest';
import { GitEngine } from './git-simulator';
import { scenarios } from './scenarios';
import { assessGoal } from './goal-checker';
import { fileStates } from './file-states';
import { cleanTrackedFiles, indexTree } from './git-state';
import { operationGuidance } from '@/learning/operation-guidance';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const lesson = (id: string) => scenarios.find(item => item.id === id)!;

describe('post-merge reliability regressions', () => {
  it('does not turn ordinary conflict-marker text into a conflict or a completed lesson', () => {
    const scenario = lesson('level-7-1');
    const engine = new GitEngine(scenario.initialState);
    const command = 'echo "<<<<<<< HEAD" > index.html';
    const result = engine.execute(command);
    expect(result.success).toBe(true);
    expect(fileStates(engine.getState()).find(file => file.path === 'index.html')?.conflict).toBe(false);
    expect(engine.openConflictResolution('index.html')).toBeNull();
    expect(assessGoal(engine.getState(), scenario, command, result).met).toBe(false);
  });
  it('can commit ordinary documentation containing conflict-marker examples', () => {
    const engine = new GitEngine();
    expect(engine.execute('echo "<<<<<<< HEAD" > example.txt').success).toBe(true);
    expect(engine.execute('git add example.txt').success).toBe(true);
    expect(engine.execute('git commit -m "Document a conflict marker"').success).toBe(true);
  });
  it.each([
    ['level-1-9', ['echo changed > README.md'], 'git reset --hard HEAD README.md'],
    ['level-1-9', ['echo changed > README.md', 'git stash push'], 'git stash drop missing-reference'],
    ['level-7-1', [], 'git merge feature missing-reference'],
  ] as const)('rejects unused destructive arguments and preserves state: %s / %s / %s', (id, setup, command) => {
    const scenario = lesson(id);
    const engine = new GitEngine(scenario.initialState);
    for (const input of setup) expect(engine.execute(input).success).toBe(true);
    const before = engine.getState();
    const result = engine.execute(command);
    expect(result.success).toBe(false);
    expect(result.newState).toBeUndefined();
    expect(engine.getState()).toEqual(before);
    expect(assessGoal(engine.getState(), scenario, command, result).met).toBe(false);
  });
  it.each([
    'git branch -D feature extra', 'git branch -m main renamed extra',
    'git checkout -b new main extra', 'git checkout main extra',
    'git reset --hard HEAD --soft', 'git rebase main extra',
    'git reflog extra', 'git blame index.html extra', 'git mv index.html renamed extra',
    'git config user.name Learner extra', 'git tag new HEAD extra',
    'git remote add origin mock://project extra', 'git remote -v extra',
    'git push origin main extra', 'git fetch origin extra', 'git pull origin main extra',
    'git worktree add ../new feature extra', 'git worktree list extra', 'cd /workspace/project extra',
    'git bisect start extra', 'git sparse-checkout init --cone extra',
    'git submodule status extra', 'git lfs install extra', 'git lfs track a b',
  ])('rejects unused arguments before any mutation: %s', command => {
    const engine = new GitEngine(lesson('level-7-1').initialState);
    const before = engine.getState();
    expect(engine.execute(command).success).toBe(false);
    expect(engine.getState()).toEqual(before);
  });
  it.each([
    ['level-7-1', 'git merge feature', 'index.html', 'merge'],
    ['operation-rebase-continue', 'git rebase main', 'app.ts', 'rebase'],
    ['operation-pick-continue', 'git cherry-pick c3', 'app.ts', 'cherry-pick'],
    ['operation-revert-continue', 'git revert c2', 'app.ts', 'revert'],
  ])('keeps a genuine %s conflict until staging and rejects malformed recovery commands', (id, start, path, kind) => {
    const engine = new GitEngine(lesson(id).initialState);
    expect(engine.execute(start).success).toBe(false);
    expect(engine.getState().unmergedPaths).toContain(path);
    expect(engine.execute('git status').message).toContain('Unmerged paths:');
    for (const command of kind === 'merge' ? ['git merge --abort extra'] : [`git ${kind} --abort extra`, `git ${kind} --continue extra`, `git ${kind} --skip extra`]) {
      const before = engine.getState();
      expect(engine.execute(command).success).toBe(false);
      expect(engine.getState()).toEqual(before);
    }
    engine.touch(path, 'Resolved');
    expect(cleanTrackedFiles(engine.getState())).toBe(false);
    expect(fileStates(engine.getState()).find(file => file.path === path)?.conflict).toBe(true);
    expect(engine.execute('git commit -m "Premature"').success).toBe(false);
    expect(engine.execute(`git add ${path}`).success).toBe(true);
    expect(engine.getState().unmergedPaths).toBeUndefined();
    expect(engine.execute(kind === 'merge' ? 'git commit -m "Resolve"' : `git ${kind} --continue`).success).toBe(true);
    expect(operationGuidance(engine.getState())).toBeNull();
  });
  it('requires staging for stash conflict completion, retains its source, and offers executable recovery guidance', () => {
    const scenario = lesson('stash-conflict');
    const engine = new GitEngine(scenario.initialState);
    expect(engine.execute('git stash pop').success).toBe(false);
    expect(engine.getState().unmergedPaths).toEqual(['app.ts']);
    const guidance = operationGuidance(engine.getState());
    expect(guidance?.commands).toEqual(['git status']);
    expect(engine.execute(guidance!.commands[0]).success).toBe(true);
    const command = 'echo "Combined" > app.ts';
    const edited = engine.execute(command);
    expect(assessGoal(engine.getState(), scenario, command, edited).met).toBe(false);
    const result = engine.execute('git add app.ts');
    const assessment = assessGoal(engine.getState(), scenario, 'git add app.ts', result);
    expect(assessment.met).toBe(true);
    expect(assessment.conditions.every(condition => condition.met)).toBe(true);
    expect(engine.getState().stash).toHaveLength(1);
    expect(operationGuidance(engine.getState())).toBeNull();
  });
  it('clears real conflicts on merge abort, replay skip, and hard reset, and preserves unrelated notes', () => {
    for (const [id, start, finish] of [
      ['level-7-1', 'git merge feature', 'git merge --abort'],
      ['level-7-1', 'git merge feature', 'git reset --hard HEAD'],
      ['operation-rebase-continue', 'git rebase main', 'git rebase --skip'],
    ]) {
      const engine = new GitEngine(lesson(id).initialState);
      engine.execute(start); engine.touch('notes.txt', 'keep');
      expect(engine.execute(finish).success).toBe(true);
      expect(engine.getState().unmergedPaths).toBeUndefined();
      expect(engine.getState().workingDirectory['notes.txt']).toBe('keep');
    }
  });
  it('stages explicit -A paths without unrelated edits and honors -- for option-like file names', () => {
    const engine = new GitEngine();
    engine.touch('one.txt', 'base'); engine.touch('two.txt', 'base');
    engine.execute('git add .'); engine.execute('git commit -m "Initial"');
    engine.touch('one.txt', 'changed'); engine.touch('two.txt', 'unrelated'); engine.touch('-p', 'literal');
    expect(engine.execute('git add -A one.txt').success).toBe(true);
    expect(indexTree(engine.getState())['one.txt']).toBe('changed');
    expect(indexTree(engine.getState())['two.txt']).toBe('base');
    expect(engine.execute('git add -- -p').success).toBe(true);
    expect(engine.getState().patchSession).toBeUndefined();
    expect(indexTree(engine.getState())['-p']).toBe('literal');
  });
  it('keeps a stash message that looks like a flag separate from its save options', () => {
    const engine = new GitEngine(lesson('stash-tracked').initialState);
    expect(engine.execute('git stash push -m "-u"').success).toBe(true);
    expect(engine.getState().stash[0].message).toBe('-u');
    expect(engine.getState().workingDirectory['notes.txt']).toBe('memo');
  });
  it.each(['1.0', '1e0', '0x1', '9007199254740993', '1 extra'])('rejects ambiguous mock PR numbers without merging or approving: %s', reference => {
    const engine = new GitEngine(lesson('github-merge').initialState);
    const before = engine.getState();
    for (const command of [`gh pr merge ${reference} --merge`, `simulate review approve ${reference}`, `gh pr view ${reference}`]) {
      expect(engine.execute(command).success).toBe(false);
      expect(engine.getState()).toEqual(before);
    }
  });
  it('supports the documented optional PR number and treats flag-like option values as data', () => {
    const engine = new GitEngine(lesson('github-merge').initialState);
    engine.execute('simulate review approve --body "--merge"');
    engine.execute('simulate ci pass');
    expect(engine.execute('gh pr merge --merge').success).toBe(true);
    expect(engine.getState().github!.pullRequests[1].status).toBe('merged');
    const create = new GitEngine(lesson('github-create').initialState);
    expect(create.execute('gh pr create --title "--head" --body "--base" --base main').success).toBe(true);
    expect(create.getState().github!.pullRequests[1]).toMatchObject({ title: '--head', body: '--base', head: 'feature/login', base: 'main' });
  });
});

describe('real Git checks for conflict identity and destructive input', () => {
  it('separates ordinary marker text from actual unmerged paths, which remain after editing and disappear after add', () => {
    const directory = mkdtempSync(join(tmpdir(), 'git-learning-unmerged-'));
    const git = (args: string[]) => spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    const write = (name: string, text: string) => writeFileSync(join(directory, name), text);
    try {
      expect(git(['init', '-b', 'main']).status).toBe(0);
      git(['config', 'user.name', 'Learning test']); git(['config', 'user.email', 'test@example.invalid']);
      write('index.html', 'base'); git(['add', '.']); git(['commit', '-m', 'Initial']);
      git(['checkout', '-b', 'feature']); write('index.html', 'feature'); git(['commit', '-am', 'Feature']);
      git(['checkout', 'main']); write('index.html', 'main'); git(['commit', '-am', 'Main']);
      const engine = new GitEngine(lesson('level-7-1').initialState);
      const before = engine.getState(); const realBefore = git(['status', '--porcelain']).stdout;
      expect(git(['merge', 'feature', 'missing-reference']).status).not.toBe(0);
      expect(engine.execute('git merge feature missing-reference').success).toBe(false);
      expect(engine.getState()).toEqual(before);
      expect(git(['status', '--porcelain']).stdout).toBe(realBefore);
      expect(git(['merge', 'feature']).status).not.toBe(0); expect(engine.execute('git merge feature').success).toBe(false);
      write('index.html', 'Resolved'); engine.touch('index.html', 'Resolved');
      expect(git(['ls-files', '-u']).stdout).toContain('index.html');
      expect(engine.getState().unmergedPaths).toContain('index.html');
      expect(git(['commit', '-m', 'Premature']).status).not.toBe(0);
      expect(engine.execute('git commit -m "Premature"').success).toBe(false);
      git(['add', 'index.html']); engine.execute('git add index.html');
      expect(git(['ls-files', '-u']).stdout).toBe(''); expect(engine.getState().unmergedPaths).toBeUndefined();
      expect(git(['commit', '-m', 'Resolve']).status).toBe(0); expect(engine.execute('git commit -m "Resolve"').success).toBe(true);
      const text = '<<<<<<< HEAD\nexample\n=======\nother example\n>>>>>>> feature';
      write('marker.md', text); engine.touch('marker.md', text);
      git(['add', 'marker.md']); engine.execute('git add marker.md');
      expect(git(['commit', '-m', 'Document markers']).status).toBe(0);
      expect(engine.execute('git commit -m "Document markers"').success).toBe(true);
      expect(fileStates(engine.getState()).find(file => file.path === 'marker.md')?.conflict).toBe(false);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('refuses hard reset with a path and invalid stash references, preserving changes and saved work', () => {
    const directory = mkdtempSync(join(tmpdir(), 'git-learning-refusal-'));
    const git = (args: string[]) => spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    try {
      git(['init', '-b', 'main']); git(['config', 'user.name', 'Learning test']); git(['config', 'user.email', 'test@example.invalid']);
      writeFileSync(join(directory, 'app.ts'), 'base'); git(['add', '.']); git(['commit', '-m', 'Initial']);
      writeFileSync(join(directory, 'app.ts'), 'draft'); writeFileSync(join(directory, 'notes.txt'), 'memo');
      const engine = new GitEngine(lesson('stash-tracked').initialState);
      const before = engine.getState();
      expect(git(['reset', '--hard', 'HEAD', 'app.ts']).status).not.toBe(0);
      expect(engine.execute('git reset --hard HEAD app.ts').success).toBe(false);
      expect(engine.getState()).toEqual(before); expect(readFileSync(join(directory, 'app.ts'), 'utf8')).toBe('draft');
      expect(git(['stash', 'push', '-m', '-u']).status).toBe(0);
      expect(engine.execute('git stash push -m "-u"').success).toBe(true);
      expect(readFileSync(join(directory, 'notes.txt'), 'utf8')).toBe('memo');
      expect(engine.getState().workingDirectory['notes.txt']).toBe('memo');
      const stashed = engine.getState(); const realStash = git(['stash', 'list']).stdout;
      expect(git(['stash', 'drop', 'missing-reference']).status).not.toBe(0);
      expect(engine.execute('git stash drop missing-reference').success).toBe(false);
      expect(engine.getState()).toEqual(stashed); expect(git(['stash', 'list']).stdout).toBe(realStash);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
