import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { SectionCard } from '@/components/ui/SectionCard';
import type { WorkflowResults as Results } from './workflowApi';

const TONES: Record<string, ChipTone> = {
  met: 'good',
  unmet: 'danger',
  insufficient_information: 'warn',
  unsupported: 'neutral',
  not_evaluated: 'neutral',
  not_applicable: 'neutral',
};
const OPEN = new Set(['unmet', 'unknown', 'insufficient_information']);
const matchKey = (matched: boolean | null) =>
  matched === null ? 'unknown' : matched ? 'true' : 'false';

/**
 * Pathways side by side, explained only from what the server evaluated.
 * Each score stays in its own system: never ranked, added or compared across programs.
 */
export function WorkflowComparison({ results }: { results: Results }) {
  const { t, i18n } = useTranslation('assessments');
  const section = useId();
  const labels = t('workflow.labels', { returnObjects: true }) as Record<string, string>;
  const states = t('workflow.states', { returnObjects: true }) as Record<string, string>;
  const checks = t('workflow.checks', { returnObjects: true }) as Record<string, string>;
  const fields = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const locale = i18n.language === 'fa' ? 'fa' : 'en';
  const state = (id: string) => states[id] ?? t('workflow.review');
  const preferenceState = (value?: string) => state(value ?? 'needs_preferences');
  const paths = Object.values(results.pathways);
  if (paths.length < 2) return null;
  return (
    <SectionCard id={section} title={t('workflow.comparison.title')} variant="panel">
      <p>{t('workflow.comparison.meaning')}</p>
      <ul className="flex min-w-0 flex-col gap-4">
        {paths.map((path) => {
          const conditions = path.conditions.map((id) => results.evaluations[id]).filter(Boolean);
          const scores = path.scores
            .map((id) => results.evaluations[id])
            .filter((row) => row && row.score.status !== 'not_applicable');
          const open = conditions.flatMap((row) => [
            ...(row?.coverage.status !== 'supported' && row?.coverage.reason
              ? [state(row.coverage.reason)]
              : []),
            ...Object.entries(row?.conditions.checks ?? {})
              .filter(([, value]) => OPEN.has(value))
              .map(
                ([key, value]) =>
                  `${checks[key] ?? fields[key] ?? t('workflow.condition')}: ${state(value)}`,
              ),
          ]);
          const unknowns = path.financial_fit.unknowns ?? [];
          const criteria = path.preferences?.reasons.checks ?? [];
          const synthetic = [...conditions, ...scores].some((row) =>
            row?.limitations.includes('synthetic_not_law'),
          );
          return (
            <li key={path.id} className="border-line flex min-w-0 flex-col gap-3 border-t pt-3">
              <h3 className="font-semibold">
                {path.title?.[locale] ?? labels[path.id] ?? t('workflow.configured')}
              </h3>
              {synthetic && <p className="text-warn">{t('workflow.synthetic')}</p>}
              <dl className="flex min-w-0 flex-col gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-text-2">{t('workflow.eligibility')}</dt>
                  <dd className="flex min-w-0 flex-col items-start gap-1">
                    <Chip tone={TONES[path.status] ?? 'neutral'} dot>
                      {state(path.status)}
                    </Chip>
                    {open.length > 0 && (
                      <ul className="list-disc ps-5">
                        {open.map((reason, index) => (
                          <li key={index}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-text-2">{t('workflow.comparison.ownScores')}</dt>
                  <dd>
                    {scores.length === 0 ? (
                      t('workflow.comparison.noScore')
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {scores.map(
                          (row) =>
                            row && (
                              <li key={row.id}>
                                {labels[row.id] ?? t('workflow.configured')}:{' '}
                                <bdi>{row.score.value ?? t('calculator.unknown')}</bdi> ·{' '}
                                {state(row.score.status)}
                              </li>
                            ),
                        )}
                      </ul>
                    )}
                  </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-text-2">{t('workflow.finance')}</dt>
                  <dd>
                    {state(path.financial_fit.status)}
                    {unknowns.length > 0 && (
                      <ul className="list-disc ps-5">
                        {unknowns.map((reason) => (
                          <li key={reason}>
                            {states[reason] ?? t('workflow.comparison.unknownReason')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-text-2">{t('workflow.preferences')}</dt>
                  <dd>
                    {preferenceState(path.preferences?.status)}
                    {criteria.length > 0 && (
                      <ul className="list-disc ps-5">
                        {criteria.map((check) => (
                          <li key={check.criterion}>
                            {t(`workflow.comparison.criteria.${check.criterion}`, {
                              defaultValue: t('workflow.comparison.criterion'),
                            })}
                            : {t(`workflow.comparison.match.${matchKey(check.matched)}`)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
