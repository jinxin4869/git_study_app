import { GitEngine } from './git-simulator';

const engine = new GitEngine();

console.log('--- Init ---');
console.log(engine.execute('git init'));

console.log('\n--- Status (Empty) ---');
console.log(engine.execute('git status'));

console.log('\n--- Create File ---');
engine.touch('file1.txt', 'Hello World');
console.log('Created file1.txt');

console.log('\n--- Status (Untracked) ---');
console.log(engine.execute('git status'));

console.log('\n--- Add ---');
console.log(engine.execute('git add file1.txt'));

console.log('\n--- Status (Staged) ---');
console.log(engine.execute('git status'));

console.log('\n--- Commit ---');
console.log(engine.execute('git commit -m "Initial commit"'));

console.log('\n--- Log ---');
console.log(engine.execute('git log'));

console.log('\n--- Status (Clean) ---');
console.log(engine.execute('git status'));
