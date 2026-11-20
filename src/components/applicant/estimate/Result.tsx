import { Trans, useTranslation } from 'react-i18next';
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
import { safeHref } from '@/lib/url';
import {
  BAND_BAR,
  BAND_TONE,
  CURRENCY_CODE,
  FIT_TONE,
  type CountryEstimate,
  type EstimateAnswers,
  type EstimateResult,
  type StudyInfo,
} from '@/lib/applicant/estimate';

/**
 * The result: the best country and every country compared on the dark card, the consultant beside
 * it, then per country what moves the chance, what a better English score would change and
 * admissions of people like them, and studying there as a way to stay (costs against the budget,
 * the stay after graduating, the route from there) (`detailsTo` instead: a link to them, for the guest home). Right
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
              title={t(
                result.assessment_scope === 'work_not_supported'
                  ? 'result.workTitle'
                  : 'result.emptyTitle',
              )}
              action={
                <a href={SITE.consultation} className={buttonClass('primary')}>
                  {t('result.consult')}
                </a>
              }
            >
              {t(
                result.assessment_scope === 'work_not_supported'
                  ? 'result.workText'
                  : 'result.empty',
              )}
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
          <CallCard contact={contact} phone={phone} freeCall={!detailsTo} />
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
      className="flex flex-col gap-6 rounded-[24px] px-5 py-6 text-on-hero shadow-luxe bg-luxe lg:rounded-[32px] lg:px-9 lg:py-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <span className="self-start rounded-full px-3 py-0.5 text-xs font-extrabold bg-luxe-gold">
            {t('result.bestKicker')}
          </span>
          <h2
            id="estimate-best"
            aria-label={t('result.best', { country: best.country.name })}
            className="m-0 font-display text-[22px] leading-snug font-semibold lg:text-[28px]"
          >
            <Trans
              ns="estimate"
              i18nKey="result.bestTitle"
              values={{ country: best.country.name }}
              components={{ em: <span className="text-luxe-gold-light" /> }}
            />
          </h2>
          <p className="m-0 text-sm leading-7 text-on-hero-2">
            {t('result.subtitle', { date: f.date(result.created_at) })}
          </p>
        </div>
        <span className="flex flex-col items-center gap-0.5">
          <span className="font-display text-[34px] leading-tight font-bold text-luxe-gold-light lg:text-[44px]">
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
                  tone="gold"
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
  freeCall,
}: {
  contact: EstimateAnswers['contact'] | null;
  phone: string | null;
  /** Off on the home, which has its own call cards. */
  freeCall: boolean;
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

  if (!freeCall) return null;
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

      {estimate.study && <StudySection study={estimate.study} countryId={estimate.country.id} />}

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

const MILLION = 1_000_000;

/**
 * Studying there as a way to stay: a year's costs (in tomans when there is a rate, and in the
 * country's currency), how they fit the budget answered, the stay after graduating and the route
 * from there, with the official page staff checked it against.
 */
function StudySection({ study, countryId }: { study: StudyInfo; countryId: number }) {
  const { t } = useTranslation('estimate');
  const f = useFormat();
  const id = `estimate-study-${String(countryId)}`;
  const code = CURRENCY_CODE[study.currency];
  const tomans = study.first_year_toman;
  const href = safeHref(study.source_url);
  const tuition =
    study.tuition.min === study.tuition.max
      ? f.money(study.tuition.min, code)
      : t('study.range', {
          min: f.money(study.tuition.min, code),
          max: f.money(study.tuition.max, code),
        });

  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="m-0 text-sm font-bold">
          {t('study.title')}
        </h3>
        <Chip tone={FIT_TONE[study.budget_fit]} dot>
          {t(`study.fit.${study.budget_fit}`)}
        </Chip>
      </div>
      <dl className="m-0 flex flex-col gap-2 text-sm leading-7">
        <div className="flex flex-col gap-0.5">
          <dt className="text-text-2">{t('study.firstYear')}</dt>
          <dd className="m-0 font-semibold">
            {tomans
              ? t(tomans.min === tomans.max ? 'study.tomansOne' : 'study.tomans', {
                  min: f.number(tomans.min / MILLION),
                  max: f.number(tomans.max / MILLION),
                })
              : t('study.noRate')}
          </dd>
          <dd className="m-0 text-xs leading-6 text-text-2">
            {t('study.costs', { tuition, living: f.money(study.living, code) })}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-text-2">{t('study.afterGraduating')}</dt>
          <dd className="m-0 font-semibold">
            {study.post_study_months === null
              ? study.post_study_visa
              : t('study.visaMonths', {
                  visa: study.post_study_visa,
                  months: f.number(study.post_study_months),
                })}
          </dd>
          <dd className="m-0">{study.after_study}</dd>
        </div>
      </dl>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-xs font-semibold text-primary-text"
        >
          {t('study.source', { date: f.date(study.checked_at) })}
          <Icon name="chevronEnd" size={14} />
        </a>
      )}
    </section>
  );
}
