import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import {
  BAND_TONE,
  type CountryEstimate,
  type EstimateAnswers,
  type EstimateResult,
} from '@/lib/applicant/estimate';

/**
 * The result: a level per country (a percentage only where the server shows one), what moves it,
 * what a better English score would change and admissions of people like them. Right after the
 * quiz, `contact` says when the consultant will call.
 */
export function Result({
  result,
  contact,
  onRetake,
}: {
  result: EstimateResult;
  contact: EstimateAnswers['contact'] | null;
  onRetake: () => void;
}) {
  const { t } = useTranslation('estimate');
  const f = useFormat();

  return (
    <PageStack>
      <PageHeader
        title={t('result.title')}
        subtitle={t('result.subtitle', { date: f.date(result.created_at) })}
        actions={
          <Button variant="outline" onClick={onRetake}>
            {t('result.retake')}
          </Button>
        }
      />

      {contact && contact.channel !== 'none' && (
        <Card
          aria-labelledby="estimate-call"
          className="flex items-center gap-4 p-5 shadow-[0_0_0_1.5px_var(--primary),var(--panel-shadow)] lg:p-7"
        >
          <span
            aria-hidden="true"
            className="flex size-12 flex-none items-center justify-center rounded-2xl bg-tint text-primary-text"
          >
            <Icon name="phone" size={22} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="estimate-call" className="m-0 text-base font-bold">
              {t('result.callTitle')}
            </h2>
            <p className="m-0 text-sm leading-7 text-text-2">
              {t(`result.call.${contact.channel}.${contact.time}`)}
            </p>
          </div>
        </Card>
      )}

      {result.countries.length === 0 ? (
        <EmptyState
          variant="card"
          icon="info"
          title={t('result.emptyTitle')}
          action={
            <a href={SITE.consultation} className={buttonClass('primary')}>
              {t('result.consult')}
            </a>
          }
        >
          {t('result.empty')}
        </EmptyState>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2 lg:gap-7">
          {result.countries.map((estimate) => (
            <li key={estimate.country.id} className="flex">
              <CountryCard estimate={estimate} />
            </li>
          ))}
        </ul>
      )}

      <Notice tone="info">{t('result.disclaimer')}</Notice>

      {(!contact || contact.channel === 'none') && result.countries.length > 0 && (
        <a href={SITE.consultation} className={buttonClass('primary', 'self-start max-sm:w-full')}>
          {t('result.consult')}
        </a>
      )}
    </PageStack>
  );
}

function CountryCard({ estimate }: { estimate: CountryEstimate }) {
  const { t } = useTranslation('estimate');
  const f = useFormat();
  const id = `estimate-country-${String(estimate.country.id)}`;
  const helps = estimate.factors.filter((factor) => factor.direction === 'up');
  const holds = estimate.factors.filter((factor) => factor.direction === 'down');

  return (
    <Card aria-labelledby={id} className="flex w-full flex-col gap-4 p-5 lg:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="m-0 font-display text-xl font-bold">
          {estimate.country.name}
        </h2>
        <span className="flex items-center gap-2">
          {estimate.chance !== null && (
            <span className="font-display text-xl font-bold">
              {t('result.percent', { n: f.number(estimate.chance) })}
            </span>
          )}
          <Chip tone={BAND_TONE[estimate.band]} dot>
            {t(`band.${estimate.band}`)}
          </Chip>
        </span>
      </div>
      <p className="m-0 text-sm leading-7 text-text-2">
        {estimate.decided > 0
          ? t('result.decided', { n: f.number(estimate.decided) })
          : t('result.fewDecided')}
      </p>

      {(helps.length > 0 || holds.length > 0) && (
        <div className="flex flex-col gap-1.5 text-sm leading-7">
          {helps.length > 0 && (
            <p className="m-0">
              <span className="font-semibold text-good">{t('result.helps')}</span>{' '}
              {f.list(helps.map((factor) => t(`factor.${factor.name}`)))}
            </p>
          )}
          {holds.length > 0 && (
            <p className="m-0">
              <span className="font-semibold text-warn">{t('result.holds')}</span>{' '}
              {f.list(holds.map((factor) => t(`factor.${factor.name}`)))}
            </p>
          )}
        </div>
      )}

      {estimate.improvements.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-tint p-4">
          <h3 className="m-0 text-sm font-bold text-primary-text">{t('result.raise')}</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm leading-7">
            {estimate.improvements.map((step) => (
              <li key={step.english}>
                {t('result.raiseStep', {
                  score: f.number(step.english),
                  from: t(`band.${step.band_from}`),
                  to: t(`band.${step.band_to}`),
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {estimate.similar.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-bold">{t('result.similar')}</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {estimate.similar.map((admission, index) => (
              <li
                key={`${admission.university}-${String(index)}`}
                className="flex items-center gap-2 text-sm leading-6"
              >
                <Icon name="graduation" size={16} className="flex-none text-text-2" />
                <span className="min-w-0">
                  {[admission.university, admission.field, f.digits(String(admission.year))]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
