import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scenarios } from './scenarios';

describe('Published exercise catalogue', () => {
  it('has unique selectable lessons with reference solutions', () => {
    expect(new Set(scenarios.map(scenario => scenario.id)).size).toBe(scenarios.length);
    for (const scenario of scenarios) expect(scenario.solution?.length, scenario.id).toBeGreaterThan(0);
  });

  it('keeps every README course count consistent with selectable lessons', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain(`現在は${scenarios.length}演習`);
    const legacy = ['基本操作', 'ブランチ', 'マージ', '作業の退避', '取り消し', '過去の調査', 'コンフリクト'];
    const counts = new Map<string, number>();
    for (const scenario of scenarios) {
      const course = scenario.category ?? legacy[Number(scenario.id.match(/^level-(\d+)/)?.[1]) - 1];
      counts.set(course, (counts.get(course) ?? 0) + 1);
    }
    const rows = [...readme.matchAll(/^\| ([^|]+) \| (\d+) \|/gm)];
    expect(rows).toHaveLength(counts.size);
    for (const [, name, count] of rows) expect(counts.get(name.trim()), name).toBe(Number(count));
  });
});
