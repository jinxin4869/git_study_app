import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform, arch } from 'node:os';
import { test, expect } from 'vitest';
import { version as vitestVersion } from 'vitest/package.json';
import { GitEngine } from '../src/engine/git-simulator';
import { calculateGraphLayout } from '../src/utils/graph-layout';
import { trackingStatus } from '../src/learning/repository-view';
import type { GitState } from '../src/types/git';

function fixture(count: number): GitState {
  const state = new GitEngine().getState();
  const payload = 'x'.repeat(1024);
  for (let index = 0; index < count; index++) {
    const id = `c${index}`;
    // Fork and merge every four commits, with equal timestamps to exercise ties.
    const parents = index === 0 ? [] : index % 4 === 2 ? [`c${index - 2}`] : index % 4 === 3 ? [`c${index - 1}`, `c${index - 2}`] : [`c${index - 1}`];
    state.commits[id] = {
      id, parents, message: `Synthetic ${index}`, author: 'Benchmark', timestamp: 0,
      changes: [], tree: Object.fromEntries(Array.from({ length: 5 }, (_, file) => [`src/file-${file}.txt`, `${index}-${file}:${payload}`])),
    };
  }
  state.branches.main = `c${count - 1}`;
  state.upstreams = {};
  for (let index = 0; index < count / 10; index++) {
    const branch = `branch-${index}`;
    state.branches[branch] = `c${index * 10 + 9}`;
    state.remoteBranches[`origin/${branch}`] = `c${index * 10 + 4}`;
    state.upstreams[branch] = `origin/${branch}`;
  }
  state.workingDirectory = { ...state.commits[state.branches.main].tree };
  return state;
}

test('synthetic history scaling (Node only)', async ({ bench }) => {
  const measurements: { commits: number; branches: number; operation: string; meanMs: number; p99Ms: number; samples: number; relativeMarginPercent: number }[] = [];
  for (const count of [100, 500, 1000]) {
    const state = fixture(count);
    const engine = new GitEngine(state);
    const layout = calculateGraphLayout(state);
    expect(layout.nodes).toHaveLength(count);
    expect(layout.links).toHaveLength(Object.values(state.commits).reduce((total, commit) => total + commit.parents.length, 0));
    expect(trackingStatus(state)).toHaveLength(count / 10);
    expect(engine.execute('git status').success).toBe(true);

    const operations = {
      layout: () => { calculateGraphLayout(state); },
      snapshot: () => { engine.getState(); },
      status: () => { engine.execute('git status'); },
      tracking: () => { trackingStatus(state); },
    };
    for (const [operation, fn] of Object.entries(operations)) {
      const result = await bench(`${count} commits: ${operation}`, fn).run({ time: 500, iterations: 30, warmupTime: 100, warmupIterations: 3 });
      expect(Number.isFinite(result.latency.mean)).toBe(true);
      expect(result.latency.samplesCount).toBeGreaterThanOrEqual(30);
      measurements.push({ commits: count, branches: Object.keys(state.branches).length, operation, meanMs: result.latency.mean, p99Ms: result.latency.p99, samples: result.latency.samplesCount, relativeMarginPercent: result.latency.rme });
    }
    expect(engine.getState()).toEqual(state);
  }
  mkdirSync('benchmark-results', { recursive: true });
  console.table(measurements.map(result => ({ commits: result.commits, operation: result.operation, meanMs: result.meanMs.toFixed(3), samples: result.samples })));
  writeFileSync('benchmark-results/scaling.json', JSON.stringify({
    measuredAt: new Date().toISOString(),
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceTreeDirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim(),
    vitest: vitestVersion,
    node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model,
    fixture: { filesPerCommit: 5, payloadBytesPerFile: 1024, equalTimestamps: true, mergeEvery: 4 },
    sampling: { minimumTimeMs: 500, minimumIterations: 30, warmupTimeMs: 100, warmupIterations: 3 },
    measurements,
  }, null, 2) + '\n');
}, 60_000);
