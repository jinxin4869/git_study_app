import { describe, expect, it } from 'vitest';
import { GitEngine } from './git-simulator';
import { remoteScenarios } from './remote-scenarios';
import { checkGoal } from './goal-checker';

describe('Remote exercises', () => {
  it.each(remoteScenarios)('$id can be solved and replayed without changing its template', scenario => {
    const original = JSON.stringify(scenario.initialState);
    const engine = new GitEngine(scenario.initialState);
    for (let attempt = 0; attempt < 2; attempt++) {
      engine.loadState(scenario.initialState!);
      expect(checkGoal(engine.getState(), scenario)).toBe(false);
      for (const command of scenario.solution!) expect(engine.execute(command).success, command).toBe(true);
      expect(checkGoal(engine.getState(), scenario, scenario.solution!.at(-1))).toBe(true);
      expect(JSON.stringify(scenario.initialState)).toBe(original);
    }
  });

  it('rejects non-fast-forward push without uploading or overwriting anything', () => {
    const scenario = remoteScenarios.find(s => s.id === 'remote-integrate')!;
    const engine = new GitEngine(scenario.initialState);
    const original = engine.getState();
    expect(engine.execute('git push origin main').success).toBe(false);
    expect(engine.getState()).toEqual(original);
  });

  it('force-with-lease refuses unexpected remote changes', () => {
    const engine = new GitEngine(remoteScenarios.find(s => s.id === 'remote-integrate')!.initialState);
    const original = engine.getState();
    expect(engine.execute('git push --force-with-lease origin main').success).toBe(false);
    expect(engine.getState()).toEqual(original);
  });

  it('pull --ff-only rejects divergent history while still fetching tracking references', () => {
    const engine = new GitEngine(remoteScenarios.find(s => s.id === 'remote-integrate')!.initialState);
    expect(engine.execute('git pull --ff-only origin main').success).toBe(false);
    const state = engine.getState();
    expect(state.branches.main).toBe('c3');
    expect(state.remoteBranches['origin/main']).toBe('c2');
    expect(state.workingDirectory).toEqual({ 'app.ts': 'version 1', 'README.md': 'Local docs' });
  });

  it('copies the entire merge graph on push and fetch, including second parents', () => {
    const scenario = remoteScenarios.find(s => s.id === 'remote-integrate')!;
    const engine = new GitEngine(scenario.initialState);
    scenario.solution!.forEach(command => engine.execute(command));
    const source = engine.getState();
    expect(source.mockServers.origin.commits.c2).toBeDefined();
    expect(source.mockServers.origin.commits.c3).toBeDefined();
    source.commits = { c1: source.commits.c1 };
    source.branches.main = 'c1';
    engine.loadState(source);
    engine.execute('git fetch origin');
    expect(engine.getState().commits.c2).toBeDefined();
    expect(engine.getState().commits.c3).toBeDefined();
  });

  it('records reset in reflog and can restore a branch from the previous HEAD', () => {
    const engine = new GitEngine(remoteScenarios.find(s => s.id === 'remote-push')!.initialState);
    engine.execute('git reset --hard HEAD~1');
    expect(engine.execute('git reflog').message).toContain('HEAD@{1}');
    expect(engine.execute('git branch rescue HEAD@{1}').success).toBe(true);
    expect(engine.getState().branches.rescue).toBe('c3');
    expect(engine.execute('git switch rescue').success).toBe(true);
    expect(engine.getState().workingDirectory['README.md']).toBe('Local docs');
  });

  it('rejects malformed revisions without changing HEAD', () => {
    const engine = new GitEngine(remoteScenarios[0].initialState);
    const original = engine.getState();
    expect(engine.execute('git reset --hard HEAD~oops').success).toBe(false);
    expect(engine.getState()).toEqual(original);
  });

  it('protects mock GitHub main from direct pushes', () => {
    const initial = remoteScenarios.find(s => s.id === 'remote-push')!.initialState!;
    const engine = new GitEngine({ ...initial, github: { requireReview: true, requireCI: true, pullRequests: {} } });
    expect(engine.execute('git push origin main').success).toBe(false);
    expect(engine.getState().mockServers.origin.branches.main).toBe('c1');
  });
});
