import { describe,it,expect } from 'vitest';
import { GitEngine } from '@/engine/git-simulator';
import { scenarios } from '@/engine/scenarios';
import { saveSession,parseSession,readBackup,exportBackup,importBackup,sessionKey,type SavedSession } from './session-store';
import { ProgressStore,PROGRESS_PREFIX } from './progress';
import { scenarioCategory } from './learning-path';
const ids=new Set(scenarios.map(item=>item.id));
const categories=new Set(scenarios.map(scenarioCategory));
class MemoryStorage {
  data=new Map<string,string>();
  get length(){return this.data.size;}
  key(i:number){return [...this.data.keys()][i]??null;}
  getItem(key:string){return this.data.get(key)??null;}
  setItem(key:string,value:string){this.data.set(key,value);}
  removeItem(key:string){this.data.delete(key);}
}
const capture=(engine:GitEngine,id:string|null=null):SavedSession=>({version:1,scenarioId:id,state:engine.getState(),output:[{type:'command',content:'git status'}],history:['git status'],hintLevel:2,lastAttempt:{command:'git status',result:{success:true,message:'status'}}});
describe('session and backup boundaries',()=>{
  it('round trips every exercise at every reference-solution step including suspended operations',()=>{
    for(const scenario of scenarios){
      const engine=new GitEngine(scenario.initialState);
      for(const command of [null,...scenario.solution!]){
        if(command)engine.execute(command);
        const session=capture(engine,scenario.id);
        expect(parseSession(JSON.stringify(session),ids).state,`${scenario.id}: ${command}`).toEqual(engine.getState());
      }
    }
  });
  it('resumes a suspended patch and interactive rebase through completion',()=>{
    for(const id of ['daily-patch','interactive-fixup']){
      const scenario=scenarios.find(item=>item.id===id) ?? scenarios.find(item=>item.solution?.some(command=>command.includes(id==='daily-patch'?'add -p':'rebase -i')))!;
      let engine=new GitEngine(scenario.initialState);
      scenario.solution!.forEach((command,index)=>{
        engine.execute(command);
        if(index===0)engine=new GitEngine(parseSession(JSON.stringify(capture(engine,scenario.id)),ids).state);
      });
      expect(engine.getState().patchSession).toBeUndefined();expect(engine.getState().operation).toBeUndefined();
    }
  });
  it('rejects cycles, dangling references, unknown versions, huge input and invalid operation data',()=>{
    const scenario=scenarios.find(item=>Object.keys(item.initialState?.commits??{}).length)!;
    const sample=capture(new GitEngine(scenario.initialState),scenario.id);
    const tip=Object.keys(sample.state.commits)[0];sample.state.commits[tip].parents=[tip];
    expect(()=>parseSession(JSON.stringify(sample),ids)).toThrow();
    expect(()=>parseSession(JSON.stringify({...capture(new GitEngine()),version:2}),ids)).toThrow();
    expect(()=>parseSession(' '.repeat(5_000_001),ids)).toThrow();
    const bad=capture(new GitEngine());bad.state.HEAD={type:'commit',value:'missing'};
    expect(()=>parseSession(JSON.stringify(bad),ids)).toThrow();
    expect(()=>parseSession(JSON.stringify({...capture(new GitEngine()),state:{...bad.state,operation:{kind:'rebase'}}}),ids)).toThrow();
  });
  it('exports progress and checkpoints, imports without deleting unrelated records, and clears checkpoints with progress',()=>{
    const from=new MemoryStorage();const store=new ProgressStore(from,ids,categories);
    store.complete('level-1-1',123);saveSession(from,capture(new GitEngine(),'level-1-1'),ids);
    const backup=readBackup(exportBackup(from,ids,categories),ids,categories);
    const to=new MemoryStorage();to.setItem('unrelated','keep');
    importBackup(to,backup,ids,categories);
    expect(new ProgressStore(to,ids,categories).snapshot().completed.get('level-1-1')).toBe(123);
    expect(parseSession(to.getItem(sessionKey('level-1-1'))!,ids).history).toEqual(['git status']);
    expect(to.getItem('unrelated')).toBe('keep');
    expect(new ProgressStore(to,ids,categories).clear('level-1-1')).toBeNull();expect(to.getItem(sessionKey('level-1-1'))).toBeNull();
  });
  it('rejects foreign keys, duplicate entries and unknown exercises before writing',()=>{
    const record=JSON.stringify({version:1,id:'unknown',completedAt:0});
    for(const records of [[['other','{}']],[[`${PROGRESS_PREFIX}complete:unknown`,record]],[[`${PROGRESS_PREFIX}hint:level-1-1`,'{}'],[`${PROGRESS_PREFIX}hint:level-1-1`,'{}']]])expect(()=>readBackup(JSON.stringify({format:'git-learning-backup',version:1,records}),ids,categories)).toThrow();
  });
  it('rolls back a partial import and protects a newer existing format',()=>{
    const storage=new MemoryStorage();const store=new ProgressStore(storage,ids,categories);store.complete('level-1-1',10);store.complete('level-1-2',20);
    const original=new Map(storage.data);
    const records=[['level-1-1',30],['level-1-2',40]].map(([id,completedAt])=>[`${PROGRESS_PREFIX}complete:${id}`,JSON.stringify({version:1,id,completedAt})] as [string,string]);
    const write=storage.setItem.bind(storage);let count=0;storage.setItem=(key,value)=>{if(++count===2)throw new Error('quota');write(key,value);};
    expect(()=>importBackup(storage,{format:'git-learning-backup',version:1,records},ids,categories)).toThrow('元の記録');expect(storage.data).toEqual(original);
    storage.setItem=write;storage.setItem(records[0][0],JSON.stringify({version:2}));
    expect(()=>importBackup(storage,{format:'git-learning-backup',version:1,records},ids,categories)).toThrow('未対応');
  });
  it('does not overwrite another tab during import rollback',()=>{
    const storage=new MemoryStorage();const store=new ProgressStore(storage,ids,categories);store.complete('level-1-1',10);store.complete('level-1-2',20);
    const first=`${PROGRESS_PREFIX}complete:level-1-1`;const second=`${PROGRESS_PREFIX}complete:level-1-2`;
    const newer=JSON.stringify({version:1,id:'level-1-1',completedAt:99});
    const write=storage.setItem.bind(storage);let count=0;
    storage.setItem=(key,value)=>{if(++count===2){write(first,newer);throw new Error('quota');}write(key,value);};
    const records:[string,string][]=[[first,JSON.stringify({version:1,id:'level-1-1',completedAt:30})],[second,JSON.stringify({version:1,id:'level-1-2',completedAt:40})]];
    expect(()=>importBackup(storage,{format:'git-learning-backup',version:1,records},ids,categories)).toThrow();
    expect(storage.getItem(first)).toBe(newer);expect(store.snapshot().completed.get('level-1-2')).toBe(20);
  });

  it('uses the same UTF-8 byte limit as the downloaded file importer',()=>{
    const storage=new MemoryStorage();const session=capture(new GitEngine());
    session.history=Array(4).fill('あ'.repeat(450000));
    const raw=JSON.stringify(session);
    expect(raw.length).toBeLessThan(5_000_000);expect(new TextEncoder().encode(raw).length).toBeGreaterThan(5_000_000);
    expect(()=>saveSession(storage,session,ids)).toThrow('5MB');expect(storage.length).toBe(0);
    storage.setItem(sessionKey(null),raw);
    expect(()=>exportBackup(storage,ids,categories)).toThrow('5MB');
  });

});
