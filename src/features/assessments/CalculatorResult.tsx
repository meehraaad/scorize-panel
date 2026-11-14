import { DestinationSaved } from './DestinationReport';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import {
  isDestinationSnapshot,
  isComparisonSnapshot,
  type Snapshot,
  type SingleSnapshot,
} from './calculatorApi';
import { ComparisonResult } from './RouteComparison';

export function CalculationResult({ snapshot }: { snapshot: Snapshot }) {
  return isDestinationSnapshot(snapshot) ? (
    <DestinationSaved snapshot={snapshot} />
  ) : isComparisonSnapshot(snapshot) ? (
    <ComparisonResult snapshot={snapshot} />
  ) : (
    <SingleResult snapshot={snapshot} />
  );
}

function SingleResult({ snapshot }: { snapshot: SingleSnapshot }) {
  const { t } = useTranslation('assessments');
  const choicesText = t('calculator.choices', { returnObjects: true }) as Record<string, string>;
  const sectionId = useId();
  const result = snapshot.payload.results;
  const score = result.crs?.score ?? result.score ?? null;
  const scenario = result.crs?.nomination_scenario;
  return (
    <SectionCard id={sectionId} title={t('calculator.result')} variant="panel">
      <p>
        {t('calculator.dateLabel')}{' '}
        <bdi>{snapshot.payload.context.assessment_date ?? t('calculator.unknown')}</bdi>
      </p>
      <p>{t('calculator.dateMeaning')}</p>
      <p>
        {t('calculator.country')}: {t(`calculator.choices.${snapshot.payload.country}`)}
      </p>
      {result.route_id && ['au-189', 'au-190', 'au-491'].includes(result.route_id) && (
        <p>
          {t('calculator.fields.subclass')}: {result.route_id.slice(3)}
        </p>
      )}
      {snapshot.stale_reasons.length > 0 && <Notice tone="warn">{t('calculator.stale')}</Notice>}
      <p>
        {t('calculator.currentScore')}: {score ?? t('calculator.partial')}
      </p>
      {result.express_entry && (
        <p>
          {t('calculator.entryStatus')}:{' '}
          {choicesText[result.express_entry.status] ?? t('calculator.unknown')}
        </p>
      )}
      {result.covered_requirements_status && (
        <p>
          {t('calculator.coveredStatus')}:{' '}
          {choicesText[result.covered_requirements_status] ?? t('calculator.unknown')}
        </p>
      )}
      {result.fsw && (
        <p>
          {t('calculator.fsw')}: {result.fsw.score ?? t('calculator.partial')}
        </p>
      )}
      {scenario && (
        <Notice tone="warn">
          <p>{t('calculator.nominationCondition')}</p>
          <p>
            {t('calculator.hypotheticalScore')}: {scenario.score ?? t('calculator.partial')}
          </p>
          <p>
            {t('calculator.delta')}: {scenario.delta ?? t('calculator.partial')}
          </p>
        </Notice>
      )}
      <p className="text-sm text-text-2">{t('calculator.selfReported')}</p>
      <p className="text-sm text-text-2">
        {t('calculator.recordRevision', { revision: snapshot.payload.context.session_revision })}
      </p>
    </SectionCard>
  );
}
