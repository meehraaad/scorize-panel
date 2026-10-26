import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { PageColumns } from '@/components/ui/PageColumns';
import { ProgressBar, StepList } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';
import {
  BAND_TONE,
  type Band,
  type CountryEstimate,
  type EstimateAnswers,
  type EstimateResult,
} from '@/lib/applicant/estimate';

/** How long a country's bar is when the server sends a level, not a percentage. */
const BAND_BAR: Record<Band, number> = { high: 85, medium: 55, low: 25 };

/**
 * The result: the best country and every country compared on the dark card, the consultant beside
 * it, then per country what moves the chance, what a better English score would change and
 * admissions of people like them (`detailsTo` instead: a link to them, for the guest home). Right
 * after the quiz, `contact` says when the consultant will call.
 * Design: the "Scorize New User Dashboard" canvas.
 */
export function Result({
  result,
  contact,
  phone,
  onRetake,
  detailsTo,
}: {
  result: EstimateResult;
  contact: EstimateAnswers['contact'] | null;
  /** The account's phone, for a call request when they didn't ask for one in the quiz. */
  phone: string | null;
  onRetake: () => void;
  detailsTo?: string | undefined;
}) {
  const { t } = useTranslation('estimate');
  const [best] = result.countries;

  return (
    <PageColumns
      asideLabel={t('result.asideLabel')}
      main={
        <>
          {best ? (
            <ResultHero result={result} best={best} />
          ) : (
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
          )}
          {best &&
            (detailsTo ? (
              <Link to={detailsTo} className={buttonClass('outline', 'self-start max-sm:w-full')}>
                {t('result.details')}
              </Link>
            ) : (
              <ul className="m-0 grid list-none gap-4 p-0 lg:gap-7 xl:grid-cols-2">
                {result.countries.map((estimate) => (
                  <li key={estimate.country.id} className="flex">
                    <CountryCard estimate={estimate} />
                  </li>
                ))}
              </ul>
            ))}
        </>
      }
      aside={
        <>
          <CallCard contact={contact} phone={phone} />
          <Button variant="outline" onClick={onRetake}>
            {t('result.retake')}
          </Button>
          <Notice tone="info">{t('result.disclaimer')}</Notice>
        </>
      }
    />
  );
}

/** The dark card: the best country, then every country side by side. */
function ResultHero({ result, best }: { result: EstimateResult; best: CountryEstimate }) {
  const { t } = useTranslation('estimate');
  const f = useFormat();
  const level = (estimate: CountryEstimate) =>
    estimate.chance === null
      ? t(`band.${estimate.band}`)
      : t('result.percent', { n: f.number(estimate.chance) });

  return (
    <section
      aria-labelledby="estimate-best"
      className="flex flex-col gap-6 rounded-[24px] bg-hero px-5 py-6 text-on-hero shadow-hero lg:rounded-[32px] lg:px-9 lg:py-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-hero-current">
            {t('result.bestKicker')}
          </span>
          <h2
            id="estimate-best"
            className="m-0 font-display text-[22px] leading-snug font-bold lg:text-[28px]"
          >
            {t('result.best', { country: best.country.name })}
          </h2>
          <p className="m-0 text-sm leading-7 text-on-hero-2">
            {t('result.subtitle', { date: f.date(result.created_at) })}
          </p>
        </div>
        <span className="flex flex-col items-start gap-0.5">
          <span className="font-display text-[34px] leading-tight font-bold lg:text-[44px]">
            {level(best)}
          </span>
          <span className="text-[13px] text-on-hero-2">{t('result.bestChance')}</span>
        </span>
      </div>
      {result.countries.length > 1 && (
        <div className="flex flex-col gap-3 pt-5 shadow-[inset_0_1px_0_var(--hero-line)]">
          <h3 className="m-0 text-[13px] font-normal text-on-hero-2">{t('result.compare')}</h3>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {result.countries.map((estimate) => (
              <li
                key={estimate.country.id}
                className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm"
              >
                <span className="truncate font-semibold">{estimate.country.name}</span>
                <ProgressBar
                  value={estimate.chance ?? BAND_BAR[estimate.band]}
                  tone="onHero"
                  size="md"
                />
                <span className="text-end font-semibold">{level(estimate)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

const CALL_STEPS = ['sent', 'call'] as const;

/**
 * The consultant: when they will be in touch (asked for in the quiz), or a free call to ask for.
 */
function CallCard({
  contact,
  phone,
}: {
  contact: EstimateAnswers['contact'] | null;
  phone: string | null;
}) {
  const { t } = useTranslation('estimate');
  const f = useFormat();

  if (contact && contact.channel !== 'none')
    return (
      <SectionCard variant="panel" id="estimate-call" title={t('result.callTitle')}>
        <StepList
          label={t('result.callSteps')}
          steps={CALL_STEPS.map((key) => ({
            key,
            label:
              key === 'sent'
                ? t('result.callSent')
                : t(`result.call.${contact.channel}.${contact.time}`),
          }))}
          current={1}
          formatNumber={f.number}
        />
      </SectionCard>
    );

  return (
    <SectionCard variant="panel" id="estimate-call" title={t('result.freeCall.title')}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 flex-none items-center justify-center rounded-2xl bg-tint text-primary-text"
        >
          <Icon name="phone" size={20} />
        </span>
        <p className="m-0 text-sm leading-7 text-text-2">{t('result.freeCall.text')}</p>
      </div>
      <CallRequestButton
        label={t('result.freeCall.button')}
        className={buttonClass('primary', 'w-full')}
        phone={phone}
        topic="admission"
        page="estimate"
        reason="guest"
      />
    </SectionCard>
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
