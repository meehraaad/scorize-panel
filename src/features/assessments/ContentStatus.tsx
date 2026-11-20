import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { healthQuery, type Draft } from './api';
const HEALTH_COUNTS = ['active_routes', 'overdue', 'blocked', 'in_review', 'ready'] as const;
const COMPARISON_COLUMNS = ['changedField', 'before', 'after'] as const;

export function ContentHealth({ onSelect }: { onSelect: (id: number) => void }) {
  const { t } = useTranslation('assessments');
  const f = useFormat();
  const query = useQuery(healthQuery);
  return (
    <SectionCard id="assessment-health" title={t('health')} variant="panel">
      {query.error ? (
        <Notice tone="error">{t('failed')}</Notice>
      ) : !query.data ? (
        <SkeletonRows rows={2} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {HEALTH_COUNTS.map((key) => (
              <div key={key}>
                <dt>{t(`healthCounts.${key}`)}</dt>
                <dd className="m-0 text-xl font-semibold">{f.number(query.data.counts[key])}</dd>
              </div>
            ))}
          </dl>
          {query.data.issues.map((issue) => (
            <div key={issue.id} className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => onSelect(issue.id)}>
                {issue.title}
              </Button>
              <span>
                {[
                  t(issue.state),
                  ...issue.reasons.map((reason) => t(`healthReasons.${reason}`)),
                ].join(t('separator'))}
              </span>
            </div>
          ))}
          <p className="text-sm text-text-2">
            {t('healthLimit', { count: query.data.issues_limit })}
          </p>
        </>
      )}
    </SectionCard>
  );
}

export function ContentComparison({ comparison }: { comparison: Draft['comparison'] }) {
  const { t } = useTranslation('assessments');
  // This is a read-only content comparison; the editor remains a form.
  const display = (value: unknown): string => {
    if (value === null || value === undefined) return t('absent');
    if (Array.isArray(value)) return value.map(display).join(t('separator'));
    if (typeof value === 'object')
      return Object.entries(value)
        .map(([key, v]) => `${t(`fields.${key}`, { defaultValue: key })}: ${display(v)}`)
        .join(t('separator'));
    if (typeof value === 'boolean') return t(value ? 'yes' : 'no');
    return typeof value === 'string' || typeof value === 'number' ? String(value) : t('absent');
  };
  return (
    <SectionCard id="assessment-content-comparison" title={t('contentComparison')} variant="panel">
      {!comparison?.version ? (
        <p>{t('noBaseline')}</p>
      ) : (
        <>
          <p>{t('baselineVersion', { version: comparison.version })}</p>
          {!comparison.changes.length && <p>{t('noChanges')}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr>
                  {COMPARISON_COLUMNS.map((key) => (
                    <th className="p-3 text-start" key={key}>
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.changes.map((change, i) => (
                  <tr key={i}>
                    <td className="p-3 align-top">
                      {change.path
                        .map((v) => t(`fields.${v}`, { defaultValue: v }))
                        .join(t('separator'))}
                    </td>
                    <td className="max-w-sm p-3 align-top break-words">{display(change.before)}</td>
                    <td className="max-w-sm p-3 align-top break-words">{display(change.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SectionCard>
  );
}
