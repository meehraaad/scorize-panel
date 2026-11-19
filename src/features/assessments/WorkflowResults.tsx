import { useTranslation } from 'react-i18next';
import { safeHref } from '@/lib/url';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import type { WorkflowResults as Results } from './workflowApi';
import { useWorkflowNames } from './workflowNames';

function sourceLinks(value: unknown): { title: string; url: string }[] {
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  const href = typeof row.url === 'string' ? safeHref(row.url) : null;
  const own = href ? [{ title: typeof row.title === 'string' ? row.title : href, url: href }] : [];
  return [...own, ...Object.values(row).flatMap(sourceLinks)];
}

/** The server supplies legal meaning. Scores stay in their own systems. */
export function WorkflowResults({ results, prefix }: { results: Results; prefix: string }) {
  const { t, i18n } = useTranslation('assessments');
  const labels = t('workflow.labels', { returnObjects: true }) as Record<string, string>;
  const states = t('workflow.states', { returnObjects: true }) as Record<string, string>;
  const fields = t('calculator.fields', { returnObjects: true }) as Record<string, string>;
  const names = useWorkflowNames();
  const locale = i18n.language === 'fa' ? 'fa' : 'en';
  const preferenceState = (value?: string) => state(value ?? 'needs_preferences');
  const label = (id: string) => labels[id] ?? t('workflow.configured');
  const state = (id: string) => states[id] ?? t('workflow.review');
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {Object.values(results.pathways).map((path) => (
        <SectionCard
          key={path.id}
          id={`${prefix}-${path.id}`}
          variant="panel"
          title={path.title?.[locale] ?? label(path.id)}
        >
          {[...path.conditions, ...path.scores].some((id) =>
            results.evaluations[id]?.limitations.includes('synthetic_not_law'),
          ) && <Notice tone="warn">{t('workflow.synthetic')}</Notice>}
          <p>
            {t('workflow.eligibility')}: <strong>{state(path.status)}</strong>
          </p>
          {[...new Set([...path.conditions, ...path.scores])].map((id) => {
            const row = results.evaluations[id];
            if (!row) return null;
            return (
              <article key={id} className="border-line flex min-w-0 flex-col gap-2 border-t pt-3">
                <h3 className="font-semibold">{names.evaluator(id, row, true)}</h3>
                <p>
                  {t('workflow.coverage')}: {state(row.coverage.status)}
                </p>
                {row.coverage.reason && <p>{state(row.coverage.reason)}</p>}
                {row.kind === 'score' && (
                  <p>
                    {t('workflow.score')}:{' '}
                    <bdi>{row.score.value ?? t('workflow.comparison.notCalculated')}</bdi> ·{' '}
                    {state(row.score.status)}
                    {names.passMark(row) && <> · {names.passMark(row)}</>}
                  </p>
                )}
                {row.missing_facts.length > 0 && (
                  <p>{t('workflow.missing', { count: row.missing_facts.length })}</p>
                )}
                <details>
                  <summary className="min-h-11 cursor-pointer py-3">
                    {t('workflow.details')}
                  </summary>
                  <div className="flex flex-col gap-3">
                    <dl>
                      {Object.entries(
                        row.kind === 'score' ? row.score.breakdown : row.conditions.checks,
                      ).map(([key, value]) => (
                        <div key={key} className="flex flex-wrap justify-between gap-2">
                          <dt>{names.part(row, key)}</dt>
                          <dd>
                            {row.kind === 'score' ? (
                              <bdi>{value ?? t('workflow.comparison.notCalculated')}</bdi>
                            ) : (
                              state(String(value))
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {Object.entries(row.evidence_states)
                      .filter(([, evidence]) => !evidence.usable)
                      .map(([key, evidence]) => (
                        <p key={key}>
                          {fields[key.replaceAll('.', '_')] ?? t('workflow.evidence')}:{' '}
                          {state(evidence.status)}
                        </p>
                      ))}
                    <h4>{t('workflow.sources')}</h4>
                    {sourceLinks(row.sources).map((source, index) => (
                      <a
                        key={`${source.url}:${index}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-11 py-2 break-words underline"
                      >
                        {source.title}
                      </a>
                    ))}
                  </div>
                </details>
              </article>
            );
          })}
          <p>
            {t('workflow.finance')}: {state(path.financial_fit.status)}
          </p>
          <p>
            {t('workflow.preferences')}: {preferenceState(path.preferences?.status)}
          </p>
        </SectionCard>
      ))}
    </div>
  );
}
