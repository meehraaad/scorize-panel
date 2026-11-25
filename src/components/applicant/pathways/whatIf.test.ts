import { describe, expect, it } from 'vitest';
import type { PathwayResult } from '@/lib/applicant/pathways';
import { whatIfChanges, whatIfLines } from './whatIfPlan';

const result = (id: number, factors: string[], extra: Partial<PathwayResult> = {}) =>
  ({
    pathway: {
      id,
      country: { id, name: `C${String(id)}` },
      name: `R${String(id)}`,
      factors,
      pass_mark: 67,
    },
    qualifies: false,
    eligible: false,
    points: 60,
    missing: [],
    scores: [],
    unanswered: [],
    ranking: null,
    ...extra,
  }) as unknown as PathwayResult;

describe('what if', () => {
  it('offers only steps up, for what the routes test', () => {
    const routes = [result(1, ['english_ielts', 'work_years']), result(2, ['german_level'])];
    expect(
      whatIfChanges(routes, { english_ielts: 6, work_years: 3.5, german_level: 'a2' }).map(
        (c) => c.id,
      ),
    ).toEqual([
      'english_ielts:7',
      'english_ielts:8',
      'work_years:4',
      'work_years:5',
      'german_level:b1',
      'german_level:b2',
    ]);
    // Already IELTS 8 and German C1: nothing more there; years unanswered: not offered.
    expect(whatIfChanges(routes, { english_ielts: 8.5, german_level: 'c1' })).toEqual([]);
    // No route tests German: never offered.
    expect(whatIfChanges([result(1, ['age'])], { german_level: 'a1' })).toEqual([]);
  });

  it('says what opens, and what gains points or ranking', () => {
    const ranking = (score: number) => ({
      kind: 'crs' as const,
      score,
      maximum: 1200,
      cutoff: null,
      cutoff_on: null,
    });
    const before = [
      result(1, []),
      result(2, [], { qualifies: true, ranking: ranking(400) }),
      result(3, []),
    ];
    const after = [
      result(1, [], { qualifies: true, points: 68 }),
      result(2, [], { qualifies: true, points: 60, ranking: ranking(430) }),
      result(3, []),
    ];
    expect(whatIfLines(before, after)).toEqual([
      { id: 1, country: 'C1', name: 'R1', opens: true, points: [60, 68], ranking: null },
      { id: 2, country: 'C2', name: 'R2', opens: false, points: null, ranking: [400, 430] },
    ]);
  });
});
