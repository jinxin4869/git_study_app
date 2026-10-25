import { describe,it,expect } from 'vitest';
import { GitEngine } from '@/engine/git-simulator';
import { commandSuggestions } from './command-suggestions';

describe('literal command suggestions',()=>{
  it('offers only supported commands and refuses invalid shell syntax',()=>{
    const state=new GitEngine().getState();
    expect(commandSuggestions('git stat',state)).toEqual([{label:'status',value:'git status '}]);
    expect(commandSuggestions('git status | gi',state)).toEqual([]);
    expect(commandSuggestions('git add "unfinished',state)).toEqual([]);
    expect(commandSuggestions('git status --i',state)).toEqual([{label:'--ignored',value:'git status --ignored '}]);
  });
  it('quotes spaces and quotes in paths so suggested commands actually work',()=>{
    const engine=new GitEngine();engine.touch('空 白".txt','content');
    const [choice]=commandSuggestions('git add 空',engine.getState());
    expect(choice.label).toBe('空 白".txt');expect(engine.execute(choice.value).success).toBe(true);
    expect(engine.getState().index['空 白".txt'].content).toBe('content');
  });
  it('does not replace already complete names, dot, or the literal separator',()=>{
    const state=new GitEngine().getState();state.branches.main='';state.branches['main-long']='';state.workingDirectory['.gitignore']='';
    expect(commandSuggestions('git merge main',state)).toEqual([]);
    expect(commandSuggestions('git add .',state)).toEqual([]);
    expect(commandSuggestions('git add --',state)).toEqual([]);
  });
  it('distinguishes reference arguments from file and option values',()=>{
    const state=new GitEngine().getState();state.branches.feature='';state.workingDirectory['feature.txt']='';state.workingDirectory['-file.txt']='';
    expect(commandSuggestions('git switch fea',state)[0].value).toBe('git switch feature ');
    expect(commandSuggestions('git restore --source HE',state)[0].value).toBe('git restore --source HEAD ');
    expect(commandSuggestions('git add -- -f',state)[0].value).toBe('git add -- -file.txt ');
    expect(commandSuggestions('git add -f',state).some(item=>item.label==='-file.txt')).toBe(false);
  });
});
