import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mergeContent } from './merge-content';
import { assessGoal } from './goal-checker';
import { scenarios } from './scenarios';
import { GitEngine } from './git-simulator';

describe('line merging against real Git', () => {
  const base = Array.from({length:12},(_,i) => `line ${i}`).join('\n')+'\n';
  const cases: [string,string,string,boolean][] = [
    [base,base.replace('line 0','first'),base.replace('line 11','last'),false],
    [base,base.replace('line 4','ours'),base.replace('line 4','theirs'),true],
    [base,base.replace('line 0','first'),base.replace('line 1\n','second\n'),true],
    [base,base.replace('line 4','same'),base.replace('line 4','same'),false],
    [base,'insert\n'+base,base+'append\n',false],
    [base,base.replace('line 0\n',''),base.replace('line 11','last'),false],
  ];
  it.each(cases)('agrees on conflict/result for case %#', (original,ours,theirs,conflict) => {
    const directory=mkdtempSync(join(tmpdir(),'git-merge-compare-'));
    try {
      for(const [name,content] of Object.entries({base:original,ours,theirs})) writeFileSync(join(directory,name),content);
      const real=spawnSync('git',['merge-file','-p',join(directory,'ours'),join(directory,'base'),join(directory,'theirs')],{encoding:'utf8'});
      expect(real.status).toBe(conflict?1:0);
      const merged=mergeContent(original,ours,theirs);
      expect(merged.conflict).toBe(conflict);
      if(!conflict) expect(merged.content).toBe(real.stdout);
    } finally {rmSync(directory,{recursive:true,force:true});}
  });
  it('keeps modification/deletion and different additions as conflicts', () => {
    expect(mergeContent('base',undefined,'edit').conflict).toBe(true);
    expect(mergeContent(undefined,'ours','theirs').conflict).toBe(true);
  });
  it('uses the line merge in normal engine commands and preserves unrelated untracked files', () => {
    const engine=new GitEngine(); engine.touch('app',base);
    for(const command of ['git add app','git commit -m base','git branch feature']) expect(engine.execute(command).success).toBe(true);
    engine.touch('app',base.replace('line 0','first'));
    for(const command of ['git add app','git commit -m first','git switch feature']) expect(engine.execute(command).success).toBe(true);
    engine.touch('app',base.replace('line 11','last'));
    for(const command of ['git add app','git commit -m last','git switch main']) expect(engine.execute(command).success).toBe(true);
    engine.touch('notes','keep');
    expect(engine.execute('git merge feature').success).toBe(true);
    const state=engine.getState();
    expect(state.workingDirectory.app).toContain('first'); expect(state.workingDirectory.app).toContain('last');
    expect(state.workingDirectory.notes).toBe('keep'); expect(state.commits[state.branches.main].tree.notes).toBeUndefined();
  });
  it.each(['git rebase feature','git cherry-pick feature'])('%s integrates non-overlapping edits', command => {
    const engine=new GitEngine();engine.touch('app',base);
    for(const cmd of ['git add app','git commit -m base','git branch feature']) expect(engine.execute(cmd).success).toBe(true);
    engine.touch('app',base.replace('line 0','first'));
    for(const cmd of ['git add app','git commit -m first','git switch feature']) expect(engine.execute(cmd).success).toBe(true);
    engine.touch('app',base.replace('line 11','last'));
    for(const cmd of ['git add app','git commit -m last','git switch main']) expect(engine.execute(cmd).success).toBe(true);
    expect(engine.execute(command).success).toBe(true);
    expect(engine.getState().workingDirectory.app).toBe(base.replace('line 0','first').replace('line 11','last'));
  });
  it('stash pop merges separate line edits without losing the saved change',()=>{
    const engine=new GitEngine();engine.touch('app',base);
    engine.execute('git add app');engine.execute('git commit -m base');
    engine.touch('app',base.replace('line 0','first'));expect(engine.execute('git stash').success).toBe(true);
    engine.touch('app',base.replace('line 11','last'));engine.execute('git add app');engine.execute('git commit -m last');
    expect(engine.execute('git stash pop').success).toBe(true);
    expect(engine.getState().workingDirectory.app).toBe(base.replace('line 0','first').replace('line 11','last'));
    expect(engine.getState().stash).toHaveLength(0);
  });
  it('mock PR merge uses the same line merge',()=>{
    const engine=new GitEngine();engine.touch('app',base);engine.execute('git add app');engine.execute('git commit -m base');engine.execute('git branch feature');
    engine.touch('app',base.replace('line 0','first'));engine.execute('git add app');engine.execute('git commit -m first');engine.execute('git switch feature');
    engine.touch('app',base.replace('line 11','last'));engine.execute('git add app');engine.execute('git commit -m last');
    const state=engine.getState();state.mockServers.origin={branches:{...state.branches},commits:state.commits};state.remotes.origin='mock://team';state.github={requireCI:false,requireReview:false,pullRequests:{}};engine.loadState(state);
    expect(engine.execute('gh pr create --title Test --body Test --base main').success).toBe(true);
    expect(engine.execute('gh pr merge 1 --merge').success).toBe(true);
    const server=engine.getState().mockServers.origin;
    expect(server.commits[server.branches.main].tree.app).toBe(base.replace('line 0','first').replace('line 11','last'));
  });
  it('help is available without changing the repository or grading a status lesson', () => {
    const engine=new GitEngine();const before=engine.getState();
    for(const command of ['git help','git help status','git switch --help','help']) expect(engine.execute(command).success).toBe(true);
    expect(engine.getState()).toEqual(before);
    expect(engine.execute('git help invented').success).toBe(false);
    const scenario=scenarios.find(item=>item.id==='level-1-3')!;
    const lessonEngine=new GitEngine(scenario.initialState);
    const result=lessonEngine.execute('git status --help');
    expect(assessGoal(lessonEngine.getState(),scenario,'git status --help',result).met).toBe(false);
  });
});
