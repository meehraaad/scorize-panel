import type { Answers, FactorValue, PathwayResult } from '@/lib/applicant/pathways';

/** One answer changed: "with an IELTS of 7". */
export interface WhatIfChange {
  id: string;
  factor: 'english_ielts' | 'work_years' | 'german_level';
  value: FactorValue;
}

const IELTS_STEPS = [6, 7, 8];
const GERMAN_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'];

/**
 * The changes worth trying for these answers: only what the person can work on (English, years of work, German),
 * only upwards, only for factors one of their routes tests, two steps each at most.
 */
export function whatIfChanges(results: readonly PathwayResult[], answers: Answers): WhatIfChange[] {
  const tested = new Set(results.flatMap((result) => result.pathway.factors));
  const changes: WhatIfChange[] = [];
  if (tested.has('english_ielts')) {
    const now = typeof answers.english_ielts === 'number' ? answers.english_ielts : 0;
    for (const band of IELTS_STEPS.filter((step) => step > now).slice(0, 2))
      changes.push({ id: `english_ielts:${String(band)}`, factor: 'english_ielts', value: band });
  }
  if (tested.has('work_years') && typeof answers.work_years === 'number') {
    for (const more of [1, 2]) {
      const years = Math.floor(answers.work_years) + more;
      if (years <= 40)
        changes.push({ id: `work_years:${String(years)}`, factor: 'work_years', value: years });
    }
  }
  if (tested.has('german_level')) {
    const now = typeof answers.german_level === 'string' ? answers.german_level : 'none';
    const index = GERMAN_LEVELS.indexOf(now);
    for (const level of GERMAN_LEVELS.slice(index + 1, index + 3))
      changes.push({ id: `german_level:${level}`, factor: 'german_level', value: level });
  }
  return changes;
}

/** What a change did, route by route: one that now fits, more points, a higher ranking score. */
export interface WhatIfLine {
  id: number;
  country: string;
  name: string;
  opens: boolean;
  points: [number, number] | null;
  ranking: [number, number] | null;
}

export function whatIfLines(
  before: readonly PathwayResult[],
  after: readonly PathwayResult[],
): WhatIfLine[] {
  const lines: WhatIfLine[] = [];
  for (const now of after) {
    const was = before.find((result) => result.pathway.id === now.pathway.id);
    if (!was) continue;
    const opens = now.qualifies && !was.qualifies;
    const points: [number, number] | null =
      now.pathway.pass_mark !== null && now.points > was.points ? [was.points, now.points] : null;
    const ranking: [number, number] | null =
      was.ranking && now.ranking && now.ranking.score > was.ranking.score
        ? [was.ranking.score, now.ranking.score]
        : null;
    if (opens || points || ranking)
      lines.push({
        id: now.pathway.id,
        country: now.pathway.country.name,
        name: now.pathway.name,
        opens,
        points,
        ranking,
      });
  }
  // Routes that open first.
  return lines.sort((a, b) => Number(b.opens) - Number(a.opens));
}
