#!/usr/bin/env node
import { mkdtempSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const labs = {
  staging: 'app.txtをstage版に編集してadd。その後working版へ再編集し、stage版だけをコミットしてください。',
  merge: 'mainとfeatureは同じファイルの離れた行を変更済みです。mainへfeatureをmergeし、FIRSTとLASTの両方を残してください。',
  restore: 'app.txtの未stage変更だけを取り消し、notes.txtの未追跡ファイルを残してください。',
  recovery: 'resetで外れたrescue.txtのコミットをreflogから見つけ、rescueブランチとして救出してください。',
};
export function git(cwd, ...args) {
  const result=spawnSync('git',['-c','user.name=Git Learner','-c','user.email=learner@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null',...args],{cwd,encoding:'utf8',env:{...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_'))),GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'}});
  if(result.status!==0) throw new Error(result.stderr || 'Gitを実行できません。');
  return result.stdout.trimEnd();
}
export function setup(name) {
  if(!Object.hasOwn(labs,name)) throw new Error('演習名: '+Object.keys(labs).join(', '));
  const cwd=mkdtempSync(join(tmpdir(),'git-learning-lab-'));
  git(cwd,'init','-b','main','--template=');
  git(cwd,'config','user.name','Git Learner');git(cwd,'config','user.email','learner@example.invalid');git(cwd,'config','commit.gpgsign','false');git(cwd,'config','core.hooksPath','/dev/null');
  const file=Array.from({length:12},(_,i)=>`line ${i+1}`).join('\n')+'\n';
  writeFileSync(join(cwd,'app.txt'), name==='merge'?file:'base\n');
  git(cwd,'add','app.txt'); git(cwd,'commit','-m','Initial');
  let rescue;
  if(name==='merge') {
    git(cwd,'branch','feature');
    writeFileSync(join(cwd,'app.txt'),file.replace('line 1\n','FIRST\n')); git(cwd,'commit','-am','Change first');
    git(cwd,'switch','feature'); writeFileSync(join(cwd,'app.txt'),file.replace('line 12\n','LAST\n')); git(cwd,'commit','-am','Change last'); git(cwd,'switch','main');
  }
  if(name==='restore') { writeFileSync(join(cwd,'app.txt'),'unwanted\n');writeFileSync(join(cwd,'notes.txt'),'keep me\n'); }
  if(name==='recovery') { writeFileSync(join(cwd,'rescue.txt'),'rescue me\n');git(cwd,'add','rescue.txt');git(cwd,'commit','-m','Rescue this commit');rescue=git(cwd,'rev-parse','HEAD');git(cwd,'reset','--hard','HEAD~1'); }
  writeFileSync(join(cwd,'.git','learning-lab.json'),JSON.stringify({version:1,name,rescue}));
  return cwd;
}
export function verify(cwd) {
  cwd=resolve(cwd);
  const marker=join(cwd,'.git','learning-lab.json');
  if(!existsSync(marker)) throw new Error('setupで作成した練習用ディレクトリを指定してください。');
  const {version,name,rescue}=JSON.parse(readFileSync(marker,'utf8'));
  if(version!==1 || !Object.hasOwn(labs,name)) throw new Error('未対応の演習です。');
  const head=git(cwd,'show','HEAD:app.txt');
  const work=readFileSync(join(cwd,'app.txt'),'utf8').trimEnd();
  let passed=false;
  if(name==='staging') passed=head==='stage' && work==='working' && git(cwd,'diff','--cached')==='';
  if(name==='merge') passed=head.startsWith('FIRST\n') && head.endsWith('\nLAST') && git(cwd,'rev-list','--parents','-n','1','HEAD').split(' ').length===3 && git(cwd,'status','--porcelain')==='';
  if(name==='restore') passed=work==='base' && readFileSync(join(cwd,'notes.txt'),'utf8')==='keep me\n' && git(cwd,'diff')==='';
  if(name==='recovery') passed=git(cwd,'rev-parse','rescue')===rescue && git(cwd,'show','rescue:rescue.txt')==='rescue me';
  return {name,passed};
}
if(process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const [action,arg]=process.argv.slice(2);
    if(action==='setup') { const cwd=setup(arg);console.log(`練習ディレクトリ: ${cwd}\n課題: ${labs[arg]}\ncd ${cwd}\n検証: プロジェクトで npm run lab -- verify ${cwd}`); }
    else if(action==='verify' && arg) { const result=verify(arg); console.log(result.passed?'達成しました。':'未達です。課題の内容とgit statusを確認してください。');process.exitCode=result.passed?0:1; }
    else console.log('npm run lab -- setup staging|merge|restore|recovery\nnpm run lab -- verify <練習ディレクトリ>');
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
