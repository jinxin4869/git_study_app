import { describe, expect, it } from 'vitest';
import { GitEngine } from './git-simulator';
import { githubScenarios } from './github-scenarios';
import { checkGoal } from './goal-checker';

const openPR = () => new GitEngine(githubScenarios.find(s => s.id === 'github-merge')!.initialState);

describe('Mock GitHub exercises', () => {
  it.each(githubScenarios)('$id has an executable solution and resets independently', scenario => {
    const initial = JSON.stringify(scenario.initialState);
    const engine = new GitEngine(scenario.initialState);
    for (let attempt = 0; attempt < 2; attempt++) {
      engine.loadState(scenario.initialState!);
      expect(checkGoal(engine.getState(), scenario)).toBe(false);
      for (const command of scenario.solution!) expect(engine.execute(command).success, command).toBe(true);
      expect(checkGoal(engine.getState(), scenario, scenario.solution!.at(-1))).toBe(true);
      expect(JSON.stringify(scenario.initialState)).toBe(initial);
    }
  });

  it('blocks unapproved, failed and stale checks without changing main', () => {
    const engine = openPR();
    const merge = () => engine.execute('gh pr merge 1 --merge');
    expect(merge().success).toBe(false);
    engine.execute('simulate review approve 1');
    engine.execute('simulate ci fail 1');
    expect(merge().success).toBe(false);
    engine.execute('simulate ci pass 1');
    engine.execute('echo "version 3" > app.ts');
    engine.execute('git add app.ts');
    engine.execute('git commit -m "New changes"');
    engine.execute('git push origin feature/login');
    expect(merge().success).toBe(false);
    engine.execute('simulate review approve 1');
    expect(merge().success).toBe(false);
    engine.execute('simulate ci pass 1');
    expect(merge().success).toBe(true);
    const state = engine.getState();
    const server = state.mockServers.origin;
    expect(server.commits[server.branches.main].tree['app.ts']).toBe('version 3');
    expect(state.branches.main).toBe('c1'); // Merge updates the mock server, not local main.
    expect(merge().success).toBe(false);
  });

  it('requires push before PR creation and refuses duplicate PRs', () => {
    const initial = githubScenarios[0].initialState!;
    const engine = new GitEngine(initial);
    engine.execute('git switch -c feature/unpublished');
    expect(engine.execute('gh pr create --title "New" --body "Description"').success).toBe(false);
    engine.execute('git switch feature/login');
    expect(engine.execute(githubScenarios[0].solution![0]).success).toBe(true);
    expect(engine.execute(githubScenarios[0].solution![0]).success).toBe(false);
  });

  it('retains independent base changes and rejects conflicting base changes', () => {
    const engine = openPR();
    const state = engine.getState();
    state.mockServers.origin.commits.c3 = { ...state.commits.c1, id: 'c3', parents: ['c1'], tree: { 'app.ts': 'version 1', 'README.md': 'Team update' } };
    state.mockServers.origin.branches.main = 'c3';
    engine.loadState(state);
    engine.execute('simulate review approve 1');
    engine.execute('simulate ci pass 1');
    expect(engine.execute('gh pr merge 1 --merge').success).toBe(true);
    const result = engine.getState().mockServers.origin;
    expect(result.commits[result.branches.main].tree).toEqual({ 'app.ts': 'version 2', 'README.md': 'Team update' });

    state.mockServers.origin.commits.c3.tree['app.ts'] = 'conflicting update';
    engine.loadState(state);
    expect(engine.execute('gh pr merge 1 --merge').success).toBe(false);
    expect(engine.getState().mockServers.origin.branches.main).toBe('c3');
  });
});
