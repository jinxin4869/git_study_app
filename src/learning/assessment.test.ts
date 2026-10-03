import { describe, expect, it } from 'vitest';
import { assessGoal, checkGoal } from '@/engine/goal-checker';
import { GitEngine } from '@/engine/git-simulator';
import { scenarios } from '@/engine/scenarios';
import { lessonHints } from './hints';
import { operationGuidance } from './operation-guidance';
import { headTree } from '@/engine/git-state';

const scenarioById = (id: string) => scenarios.find(item => item.id === id)!;

describe('shared grading requirements and learning guidance', () => {
  it.each(scenarios)('$id explains every solution step and all failed attempts consistently', scenario => {
    const engine = new GitEngine(scenario.initialState);
    expect(assessGoal(engine.getState(), scenario).met).toBe(false);
    for (const command of scenario.solution!) {
      const result = engine.execute(command);
      const assessment = assessGoal(engine.getState(), scenario, command, result);
      expect(assessment.conditions.length).toBeGreaterThan(0);
      expect(assessment.met).toBe(assessment.conditions.every(item => item.met));
      expect(checkGoal(engine.getState(), scenario, command, result)).toBe(assessment.met);
      if (!result.success && scenario.goal.type !== 'conflict_present') expect(assessment.met).toBe(false);
    }
    expect(checkGoal(engine.getState(), scenario, scenario.solution!.at(-1))).toBe(true);
    const invalid = engine.execute('git status --not-a-real-option');
    expect(invalid.success).toBe(false);
    expect(assessGoal(engine.getState(), scenario, 'git status --not-a-real-option', invalid).met).toBe(false);
    const hints = lessonHints(scenario);
    expect(hints.map(item => item.title)).toEqual(['考え方', '確認方法', 'コマンド', '解答例']);
    expect(hints[3].text).toBe(scenario.solution!.join('\n'));
    expect(hints[0].text + hints[1].text).not.toMatch(/`git |git commit -m|git rebase --/);
  });

  it('identifies missing file content and branch without accepting command text alone', () => {
    const scenario = scenarioById('daily-split');
    const engine = new GitEngine(scenario.initialState);
    scenario.solution!.forEach(cmd => engine.execute(cmd));
    expect(assessGoal(engine.getState(), scenario).met).toBe(true);
    const wrong = engine.getState();
    wrong.HEAD = { type: 'commit', value: wrong.branches.main };
    wrong.workingDirectory['README.md'] = 'wrong';
    const detailed = assessGoal(wrong, scenario);
    expect(detailed.met).toBe(false);
    expect(detailed.conditions.filter(item => !item.met).length).toBeGreaterThan(0);
    expect(assessGoal(new GitEngine(scenario.initialState).getState(), scenario, scenario.solution!.at(-1), { success: true, message: '' }).met).toBe(false);
  });

  it('requires the latest PR review and CI, and explains both independently', () => {
    const scenario = scenarios.find(item => item.goal.type === 'github_state' && item.goal.params?.status === 'merged')!;
    const engine = new GitEngine(scenario.initialState);
    scenario.solution!.forEach(cmd => engine.execute(cmd));
    const requirements = { ...scenario, goal: { type: 'github_state' as const, params: { status: 'merged', review: 'approved', checks: 'success' } } };
    const state = engine.getState();
    const pr = state.github!.pullRequests[1];
    pr.review!.commitId = 'old';
    pr.checks!.commitId = 'old';
    const unmet = assessGoal(state, requirements, scenario.solution!.at(-1)).conditions.filter(item => !item.met);
    expect(unmet.map(item => item.id)).toEqual(expect.arrayContaining(['review', 'checks']));
  });

  it('keeps context when checking remote trees and specific PR numbers', () => {
    const engine = new GitEngine();
    const state = engine.getState();
    state.mockServers.origin = { commits: { c1: { id: 'c1', message: '', parents: [], author: '', timestamp: 0, changes: [], tree: { 'a.txt': 'yes' } } }, branches: { alternate: 'c1' } };
    const scenario = { ...scenarioById('level-1-1'), goal: { type: 'state_matches' as const, params: { remoteBranch: 'alternate', remoteTree: { 'a.txt': 'yes' } } } };
    expect(assessGoal(state, scenario).met).toBe(true);
    state.github = { requireReview: false, requireCI: false, pullRequests: { 2: { number: 2, title: 'Second', body: '', base: 'main', head: 'feature', headCommit: 'c1', status: 'open' } } };
    const prScenario = { ...scenario, goal: { type: 'github_state' as const, params: { number: 2, title: 'Second' } } };
    expect(assessGoal(state, prScenario).met).toBe(true);
  });

  it.each(['rebase', 'cherry-pick', 'revert'] as const)('%s controls match the engine and an abort preserves files', kind => {
    const scenario = scenarios.find(item => item.category === '競合の継続・中断' && item.solution?.[0].startsWith(`git ${kind} `))!;
    const engine = new GitEngine(scenario.initialState);
    const before = engine.getState();
    engine.execute(scenario.solution![0]);
    const guide = operationGuidance(engine.getState())!;
    expect(guide.commands).toContain(`git ${kind} --continue`);
    expect(guide.commands).toContain(`git ${kind} --abort`);
    expect(engine.execute(`git ${kind} --continue`).success).toBe(false);
    expect(engine.execute(`git ${kind} --abort`).success).toBe(true);
    expect(headTree(engine.getState())).toEqual(headTree(before));
    expect(operationGuidance(engine.getState())).toBeNull();
  });
  it('offers commit rather than unsupported merge --continue, and abort works', () => {
    const engine = new GitEngine(scenarioById('level-7-1').initialState);
    engine.execute('git merge feature');
    const guide = operationGuidance(engine.getState())!;
    expect(guide.commands).toContain('git commit -m "Resolve merge"');
    expect(guide.commands).not.toContain('git merge --continue');
    expect(engine.execute('git merge --abort').success).toBe(true);
    expect(operationGuidance(engine.getState())).toBeNull();
  });
  it('does not offer skip while editing the rebase todo', () => {
    const scenario = scenarios.find(item => item.solution?.[0].startsWith('git rebase -i'))!;
    const engine = new GitEngine(scenario.initialState);
    engine.execute(scenario.solution![0]);
    expect(operationGuidance(engine.getState())!.commands).not.toContain('git rebase --skip');
    expect(engine.execute('git rebase --abort').success).toBe(true);
  });
});
