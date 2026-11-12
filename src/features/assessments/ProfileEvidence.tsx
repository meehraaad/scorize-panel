import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { profileEvidenceQuery, type Country, type ProfileCandidate } from './calculatorApi';

export function ProfileEvidence({
  id,
  country,
  disabled,
  onPrepare,
}: {
  id: string;
  country: Country;
  disabled: boolean;
  onPrepare: (candidate: ProfileCandidate) => void;
}) {
  const { t } = useTranslation('assessments');
  const sourceLabels = t('calculator.profile.sources', { returnObjects: true }) as Record<
    string,
    string
  >;
  const detailLabels = t('calculator.profile.details', { returnObjects: true }) as Record<
    string,
    string
  >;
  const reasons = t('calculator.profile.reasons', { returnObjects: true }) as Record<
    string,
    string
  >;
  const sectionId = useId();
  const query = useQuery(profileEvidenceQuery(id, country));
  const details = (values: Record<string, unknown>) => (
    <dl className="flex flex-col gap-1 text-sm">
      {Object.entries(values)
        .filter(([key]) => key !== 'pk')
        .map(([key, value]) => (
          <div key={key} className="flex flex-wrap gap-x-2">
            <dt className="text-text-2">{detailLabels[key] ?? t('calculator.unknown')}</dt>
            <dd className="m-0 break-words">
              {value === null
                ? t('calculator.unknown')
                : typeof value === 'boolean'
                  ? t(value ? 'yes' : 'no')
                  : typeof value === 'string' || typeof value === 'number'
                    ? value
                    : t('calculator.unknown')}
            </dd>
          </div>
        ))}
    </dl>
  );
  return (
    <SectionCard id={sectionId} title={t('calculator.profile.title')} variant="panel">
      <div className="flex flex-col gap-4">
        <p>{t('calculator.profile.explanation')}</p>
        {query.isPending && <SkeletonRows rows={2} />}
        {query.error && <Notice tone="error">{t('calculator.failed')}</Notice>}
        <Button
          variant="outline"
          disabled={disabled || query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('calculator.profile.reload')}
        </Button>
        {query.data?.candidates.length === 0 && query.data.context.length === 0 && (
          <p>{t('calculator.profile.empty')}</p>
        )}
        {query.data?.candidates.map((candidate, index) => (
          <article
            key={candidate.id}
            className="border-line flex flex-col gap-2 rounded-xl border p-3"
          >
            <h3>
              {t('calculator.profile.item', {
                index: index + 1,
                source: sourceLabels[candidate.source] ?? t('calculator.unknown'),
              })}
            </h3>
            {details(candidate.original)}
            {candidate.conflict && <Notice tone="warn">{t('calculator.profile.conflict')}</Notice>}
            {!candidate.complete && <p>{t('calculator.profile.incomplete')}</p>}
            <Button variant="outline" disabled={disabled} onClick={() => onPrepare(candidate)}>
              {t('calculator.profile.prepare')}
            </Button>
          </article>
        ))}
        {query.data?.context.map((item, index) => (
          <article key={index} className="border-line flex flex-col gap-2 rounded-xl border p-3">
            <h3>{sourceLabels[item.source] ?? t('calculator.unknown')}</h3>
            {details(item.original)}
            <p>{reasons[item.reason] ?? t('calculator.unknown')}</p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
