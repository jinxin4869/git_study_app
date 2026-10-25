import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync,rmSync,mkdtempSync,mkdirSync,copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setup,verify,git } from './real-git-lab.mjs';
for (const name of ['staging','merge','restore','recovery']) test(`real Git lab: ${name} rejects the initial state and accepts the solution`,()=>{
  const cwd=setup(name);
  try {
    let passed=false;try{passed=verify(cwd).passed;}catch{/* Missing rescue is an unmet task. */}
    assert.equal(passed,false);
    if(name==='staging'){writeFileSync(join(cwd,'app.txt'),'stage\n');git(cwd,'add','app.txt');writeFileSync(join(cwd,'app.txt'),'working\n');git(cwd,'commit','-m','Record staged content');}
    if(name==='merge')git(cwd,'merge','feature','-m','Merge feature');
    if(name==='restore')git(cwd,'restore','app.txt');
    if(name==='recovery')git(cwd,'branch','rescue',git(cwd,'reflog','--format=%H').split('\n')[1]);
    assert.equal(verify(cwd).passed,true);
  } finally { rmSync(cwd,{recursive:true,force:true}); }
});
test('verification refuses an unrelated directory',()=>{
  const cwd=mkdtempSync(join(tmpdir(),'git-lab-unrelated-'));
  try {assert.throws(()=>verify(cwd),/setup/);} finally{rmSync(cwd,{recursive:true,force:true});}
});
test('setup never follows inherited Git repository/index environment variables',()=>{
  const old=process.env.GIT_DIR;process.env.GIT_DIR=join(tmpdir(),'nonexistent-learning-git-dir');
  let cwd;
  try {cwd=setup('staging');assert.equal(git(cwd,'branch','--show-current'),'main');}
  finally{if(old===undefined)delete process.env.GIT_DIR;else process.env.GIT_DIR=old;if(cwd)rmSync(cwd,{recursive:true,force:true});}
});

test('CLI starts from a directory containing Japanese characters and spaces',()=>{
  const root=mkdtempSync(join(tmpdir(),'git-lab-cli-'));
  const directory=join(root,'日本語 folder');let lab;
  try {
    mkdirSync(directory);const script=join(directory,'real-git-lab.mjs');copyFileSync(fileURLToPath(new URL('./real-git-lab.mjs',import.meta.url)),script);
    const result=spawnSync(process.execPath,[script,'setup','staging'],{encoding:'utf8'});
    assert.equal(result.status,0);assert.match(result.stdout,/練習ディレクトリ:/);
    lab=result.stdout.match(/練習ディレクトリ: (.+)/)?.[1];assert.ok(lab);assert.equal(git(lab,'branch','--show-current'),'main');
  } finally {if(lab)rmSync(lab,{recursive:true,force:true});rmSync(root,{recursive:true,force:true});}
});
