import {describe,it,expect} from 'vitest';
import {GitEngine} from '@/engine/git-simulator';
import {scenarios} from '@/engine/scenarios';
import {applyWorkingFile,openWorkingFile} from './working-file-edit';

describe('working file editor boundaries',()=>{
  it('writes exact multiline literals, retaining staged content and an unstaged deletion',()=>{
    const engine=new GitEngine();engine.touch('空 白".txt','staged');engine.execute('git add .');
    const draft=openWorkingFile(engine.getState(),'空 白".txt');const content='first\n"quoted" \\literal $HOME ; git reset --hard\nlast\n';
    expect(applyWorkingFile(engine,draft,draft.path!,content).success).toBe(true);
    expect(engine.getState().workingDirectory[draft.path!]).toBe(content);expect(engine.getState().index[draft.path!].content).toBe('staged');
    expect(applyWorkingFile(engine,openWorkingFile(engine.getState(),draft.path!),draft.path!,undefined).success).toBe(true);
    expect(engine.getState().workingDirectory[draft.path!]).toBeUndefined();expect(engine.getState().index[draft.path!].content).toBe('staged');
  });
  it('rejects stale files, changed branches, collisions and relative-path escapes without mutation',()=>{
    const engine=new GitEngine();engine.touch('app','base');engine.execute('git add .');engine.execute('git commit -m base');
    const draft=openWorkingFile(engine.getState(),'app');engine.touch('app','newer');let before=engine.getState();expect(applyWorkingFile(engine,draft,'app','old').success).toBe(false);expect(engine.getState()).toEqual(before);
    const switched=openWorkingFile(engine.getState(),'app');engine.execute('git switch -c other');before=engine.getState();expect(applyWorkingFile(engine,switched,'app','draft').success).toBe(false);expect(engine.getState()).toEqual(before);
    const fresh=openWorkingFile(engine.getState(),null);
    for(const path of ['app','app/child','../outside','/absolute','C:\\absolute','a//b','.git/config'])expect(applyWorkingFile(engine,fresh,path,'x').success,path).toBe(false);
    expect(engine.getState()).toEqual(before);
    expect(applyWorkingFile(engine,fresh,'constructor/file','').success).toBe(true);
  });
  it('keeps actual conflicts unresolved until staging and refuses edits during partial staging',()=>{
    const conflict=scenarios.find(item=>item.id==='level-7-3')!;const engine=new GitEngine(conflict.initialState);
    const paths=[...engine.getState().unmergedPaths!];
    expect(applyWorkingFile(engine,openWorkingFile(engine.getState(),'index.html'),'index.html','resolved').success).toBe(true);expect(engine.getState().unmergedPaths).toEqual(paths);
    const partial=scenarios.find(item=>item.solution?.some(command=>command.startsWith('git add -p')))!;engine.loadState(partial.initialState!);engine.execute(partial.solution!.find(command=>command.startsWith('git add -p'))!);
    const state=engine.getState(),path=Object.keys(state.workingDirectory)[0];expect(state.patchSession).toBeDefined();expect(applyWorkingFile(engine,openWorkingFile(state,path),path,'blocked').success).toBe(false);expect(engine.getState()).toEqual(state);
  });
});
