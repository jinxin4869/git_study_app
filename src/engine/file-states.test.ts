import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GitEngine } from './git-simulator';
import { fileStates, fileStateLabels } from './file-states';
import { FileTree } from '@/components/file-tree';

function trackedEngine(content = 'base', path = 'file.txt') {
  const engine = new GitEngine();
  engine.touch(path, content);
  engine.execute('git add .');
  engine.execute('git commit -m "Initial"');
  return engine;
}

describe('File states shown in the tree and status', () => {
  it('shows a deleted path from HEAD, stages it, then removes it after commit', () => {
    const engine = trackedEngine();
    engine.execute('rm file.txt');
    let file = fileStates(engine.getState())[0];
    expect(file.path).toBe('file.txt');
    expect(file.content).toBeUndefined();
    expect(fileStateLabels(file)).toEqual(['削除（未stage）']);
    expect(engine.execute('git status').message).toContain('Changes not staged for commit:\n  deleted: file.txt');
    engine.execute('git add .');
    file = fileStates(engine.getState())[0];
    expect(fileStateLabels(file)).toEqual(['削除（stage済み）']);
    expect(engine.execute('git status').message).toContain('Changes to be committed:\n  deleted: file.txt');
    engine.execute('git commit -m "Delete"');
    expect(fileStates(engine.getState())).toEqual([]);
  });

  it('shows staged deletion and an untracked recreation together', () => {
    const engine = trackedEngine();
    engine.execute('git rm file.txt');
    engine.touch('file.txt', 'recreated');
    expect(fileStateLabels(fileStates(engine.getState())[0])).toEqual(['削除（stage済み）', '未追跡']);
    const output = engine.execute('git status').message;
    expect(output).toContain('deleted: file.txt');
    expect(output).toContain('Untracked files:\n  file.txt');
  });

  it('shows both staged and unstaged edits, including an empty working file', () => {
    const engine = trackedEngine();
    engine.touch('file.txt', 'staged');
    engine.execute('git add .');
    engine.touch('file.txt', '');
    const file = fileStates(engine.getState())[0];
    expect(file.content).toBe('');
    expect(fileStateLabels(file)).toEqual(['変更（stage済み）', '変更（未stage）']);
    const output = engine.execute('git status').message;
    expect(output).toContain('staged: file.txt');
    expect(output).toContain('modified: file.txt');
  });

  it('treats a new staged empty file as an addition and records a later edit separately', () => {
    const engine = new GitEngine();
    engine.touch('empty.txt', '');
    engine.execute('git add .');
    expect(fileStateLabels(fileStates(engine.getState())[0])).toEqual(['追加（stage済み）']);
    engine.touch('empty.txt', 'later');
    expect(fileStateLabels(fileStates(engine.getState())[0])).toEqual(['追加（stage済み）', '変更（未stage）']);
  });

  it('uses the same clean state for a full index and a legacy overlay index', () => {
    const engine = trackedEngine('');
    const state = engine.getState();
    const fullIndex = { ...state, index: { 'file.txt': { path: 'file.txt', content: '', status: 'unmodified' as const } } };
    expect(fileStates(fullIndex)).toEqual(fileStates(state));
    expect(fileStateLabels(fileStates(fullIndex)[0])).toEqual([]);
  });

  it('labels ignored files and avoids false deletions outside a sparse checkout', () => {
    const engine = trackedEngine('base', 'src/file.txt');
    engine.touch('docs/guide.txt', 'guide');
    engine.touch('.gitignore', '*.log');
    engine.execute('git add .');
    engine.execute('git commit -m "Docs and ignore"');
    engine.touch('debug.log', 'generated');
    expect(fileStateLabels(fileStates(engine.getState()).find(file => file.path === 'debug.log')!)).toEqual(['無視対象']);
    engine.execute('git sparse-checkout set src');
    expect(fileStates(engine.getState()).some(file => file.path === 'docs/guide.txt')).toBe(false);
    expect(engine.execute('git status').message).not.toContain('deleted: docs/guide.txt');
  });

  it('renders a deleted file and a new folder with the same special name', () => {
    const engine = trackedEngine('base', 'constructor');
    engine.execute('rm constructor');
    engine.touch('constructor/file.txt', 'new');
    const markup = renderToStaticMarkup(createElement(FileTree, { state: engine.getState(), onFileClick: () => {} }));
    expect(markup).toContain('aria-label="constructorを開く"');
    expect(markup).toContain('削除（未stage）');
    expect(markup).toContain('aria-label="constructorフォルダ"');
  });
});
