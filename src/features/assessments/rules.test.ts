import { describe, expect, it } from 'vitest';
import { assessmentOptionsFixture } from '@/mocks/assessments';
import { questionUsage, removeQuestion, removeRoute } from './rules';
import type { DraftInput } from './api';

function input(): DraftInput {
  return {
    key: 'test',
    title: 'Test',
    ...structuredClone(assessmentOptionsFixture),
    sources: [
      {
        title: 'Test',
        url: 'https://example.org',
        reviewed_on: '2026-11-11',
        review_due: '2026-12-11',
        route_ids: ['sandbox-study', 'sandbox-work'],
      },
    ],
  };
}
describe('assessment definition edits', () => {
  it('shows indirect uses and prevents breaking a live reference', () => {
    const data = input();
    expect(questionUsage(data.bundle, 'sponsor').some((use) => use.reason === 'eligibility')).toBe(
      true,
    );
    expect(removeQuestion(data, 'sponsor')).toBe(data);
  });
  it('removes a route from source coverage and all reference expectations without altering the original', () => {
    const data = input();
    const changed = removeRoute(data, 'sandbox-work');
    expect(changed.bundle.routes.map((r) => r.id)).toEqual(['sandbox-study']);
    expect(changed.sources[0]?.route_ids).toEqual(['sandbox-study']);
    expect(changed.scenarios[0]?.expected.map((r) => r.route_id)).toEqual(['sandbox-study']);
    expect(data.bundle.routes).toHaveLength(2);
  });
  it('removes unused facts from scenarios while retaining other answers', () => {
    const data = input();
    data.bundle.questions.push({ id: 'unused', text: 'Unused', kind: 'boolean' });
    const scenario = data.scenarios[0];
    if (!scenario) throw new Error('Missing reference scenario');
    scenario.answers.unused = { status: 'known', value: true };
    const changed = removeQuestion(data, 'unused');
    expect(changed.scenarios[0]?.answers.unused).toBeUndefined();
    expect(changed.scenarios[0]?.answers.age).toEqual(data.scenarios[0]?.answers.age);
  });
});
