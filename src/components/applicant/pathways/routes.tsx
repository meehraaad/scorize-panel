import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/Progress';
import { CURRENCY_CODE, FIT_TONE } from '@/lib/applicant/estimate';
import type { FinderStudy, PathwayResult } from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import type { Country } from './plan';
import { Bar, Forward, MAIN_ON_PHONE } from './answers';
import { QuizIcon, SmallFlag, type QuizIconName } from './art';
import { key } from './keys';
import { verdict } from './verdict';

/** The factors a suggestion can name (Django `pathways.rules.IMPROVABLE`), and those named by a choice. */
const IMPROVE_FACTORS = new Set([
  'education',
  'recognition',
  'work_years',
  'english_ielts',
  'english_level',
  'german_level',
  'job_offer',
  'skills_assessment',
]);
const CHOICE_FACTORS = new Set(['education', 'recognition', 'english_level', 'german_level']);

/** A fact of a route (its time, its cost): a small icon and label over the value. */
function Fact({ icon, label, value }: { icon: QuizIconName; label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse gap-1">
      <dt className="flex items-center gap-1.5 text-label text-text-2">
        <QuizIcon name={icon} size={16} />
        {label}
      </dt>
      <dd className="m-0 text-small font-semibold lg:text-body">{value}</dd>
    </div>
  );
}

/** A note on a route card: what would help (from the person's own answers) or the staff tip. */
function Note({
  icon,
  title,
  good = false,
  children,
}: {
  icon: QuizIconName;
  title: string;
  good?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-3.5 rounded-2xl p-4 lg:px-5 ${good ? 'bg-good-tint' : 'bg-canvas'}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-9 flex-none items-center justify-center rounded-full ${
          good ? 'bg-good text-surface' : 'bg-surface text-primary-text'
        }`}
      >
        <QuizIcon name={icon} size={19} />
      </span>
      <div className="flex min-w-0 flex-col gap-1 text-small lg:text-body">
        <span className={`text-sm font-semibold ${good ? 'text-good' : 'text-primary-text'}`}>
          {title}
        </span>
        {children}
      </div>
    </div>
  );
}

const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

/**
 * A study route's first year: tuition and living in tomans (in billions once it reaches one), the
 * same in the country's own currency, how it fits the budget given, and the stay after graduating.
 */
function StudyCosts({ study }: { study: FinderStudy }) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const code = CURRENCY_CODE[study.currency];
  const tomans = study.first_year_toman;
  // One decimal in billions ("1.4 to 1.7 billion"), whole millions below a billion.
  const inBillions = tomans !== null && tomans.max >= BILLION;
  const amount = (value: number) =>
    f.number(inBillions ? Math.round(value / (BILLION / 10)) / 10 : Math.round(value / MILLION));
  const tuition =
    study.tuition.min === study.tuition.max
      ? f.money(study.tuition.min, code)
      : t('study.range', {
          min: f.money(study.tuition.min, code),
          max: f.money(study.tuition.max, code),
        });
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-canvas p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-primary-text">
          <QuizIcon name="wallet" size={18} />
          {t('study.first_year')}
        </span>
        {study.budget_fit !== 'unknown' && (
          <Chip tone={FIT_TONE[study.budget_fit]} dot>
            {t(key(`study.fit.${study.budget_fit}`))}
          </Chip>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-2xl leading-tight font-extrabold tracking-tight tabular-nums">
          {tomans
            ? t(
                key(
                  `study.${inBillions ? 'billions' : 'millions'}${tomans.min === tomans.max ? '_one' : ''}`,
                ),
                { min: amount(tomans.min), max: amount(tomans.max) },
              )
            : t('study.no_rate')}
        </span>
        <span className="text-sm leading-7 text-text-2">
          {t('study.costs', { tuition, living: f.money(study.living, code) })}
        </span>
      </div>
      {study.post_study_visa && (
        <div className="flex items-start gap-3 border-t border-hair pt-4 text-small lg:text-body">
          <QuizIcon name="cap" size={18} className="mt-1 flex-none text-text-2" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">
              {study.post_study_months === null
                ? study.post_study_visa
                : t('study.after_months', {
                    visa: study.post_study_visa,
                    months: f.number(study.post_study_months),
                  })}
            </span>
            {study.after_study && <span className="text-text-2">{study.after_study}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

export function RouteCard({ result, lead = false }: { result: PathwayResult; lead?: boolean }) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const { pathway } = result;
  const fit = verdict(result);
  // Django's suggestions for this person, the ones this page can word.
  const steps = (result.improvements ?? []).filter((step) => IMPROVE_FACTORS.has(step.factor));
  const max = Math.max(pathway.max_points, pathway.pass_mark ?? 0, result.points, 1);
  return (
    <article
      className={`flex flex-col gap-6 rounded-3xl bg-surface p-6 shadow-panel lg:p-9 ${
        lead ? 'shadow-[0_0_0_1.5px_var(--primary),var(--panel-shadow)] lg:p-10' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 text-sm text-text-2">
            <SmallFlag code={pathway.country.code} name={pathway.country.name} />
            {pathway.country.name}
          </span>
          <h2
            className={`m-0 mt-1.5 leading-snug font-extrabold tracking-tight text-balance ${
              lead ? 'text-title lg:text-3xl' : 'text-xl lg:text-2xl'
            }`}
          >
            {pathway.name}
          </h2>
        </div>
        <Chip tone={fit.tone}>{t(key(fit.key))}</Chip>
      </div>
      {pathway.summary && <p className="m-0 text-base leading-8 lg:text-lg">{pathway.summary}</p>}
      {pathway.pass_mark !== null && (
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between gap-3 text-sm text-text-2">
            <span>{t('facts.score')}</span>
            <span className="tabular-nums">
              {t('facts.score_value', {
                points: f.number(result.points),
                pass: f.number(pathway.pass_mark),
              })}
            </span>
          </div>
          <ProgressBar
            value={Math.min(100, (result.points / max) * 100)}
            mark={(pathway.pass_mark / max) * 100}
            tone={result.qualifies ? 'good' : 'warn'}
          />
        </div>
      )}
      {result.study && <StudyCosts study={result.study} />}
      {(pathway.duration || (pathway.cost && !result.study)) && (
        <dl className="m-0 grid grid-cols-2 gap-4 border-t border-hair pt-5">
          {pathway.duration && (
            <Fact icon="clock" label={t('facts.time')} value={pathway.duration} />
          )}
          {pathway.cost && !result.study && (
            <Fact icon="wallet" label={t('facts.cost')} value={t(key(`cost.${pathway.cost}`))} />
          )}
        </dl>
      )}
      {result.missing.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <QuizIcon name="target" size={16} className="text-text-2" />
            {t('missing')}
          </span>
          <ul className="m-0 flex flex-col gap-1 ps-5 text-sm leading-7">
            {result.missing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {(result.near?.length ?? 0) > 0 && (
        <Note icon="wallet" title={t('near.title')}>
          {t('near.body', { list: f.list(result.near ?? []) })}
        </Note>
      )}
      {steps.length > 0 && (
        <Note icon="rise" title={t('improve.title')} good>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {steps.map((step) => (
              <li key={step.factor}>
                {t(step.passes ? 'improve.passes' : 'improve.gain', {
                  text: t(key(`improve.${step.factor}`), {
                    value: CHOICE_FACTORS.has(step.factor)
                      ? t(key(`choices.${step.factor}.${step.target}`))
                      : f.number(Number(step.target)),
                  }),
                  points: f.number(step.points),
                })}
              </li>
            ))}
          </ul>
        </Note>
      )}
      {pathway.tip && (
        <Note icon="sparkle" title={t('tip')}>
          {pathway.tip}
        </Note>
      )}
    </article>
  );
}

export function FirstResult({
  result,
  countries,
  busy,
  onMore,
  onEnough,
}: {
  result: PathwayResult | undefined;
  countries: (Country & { left: number })[];
  busy: boolean;
  onMore: () => void;
  onEnough: () => void;
}) {
  const { t } = useTranslation('pathways');
  const nextCountry = countries[0];
  return (
    <div className="flex animate-rise flex-col gap-8">
      <h1 className="m-0 text-title font-extrabold tracking-tight">{t('first.title')}</h1>
      {result && <RouteCard result={result} lead />}
      <Bar stick={false}>
        <Button size="lg" className={MAIN_ON_PHONE} onClick={onMore}>
          {nextCountry
            ? t('first.continue', { count: nextCountry.left, country: nextCountry.name })
            : t('first.keep')}
          <Forward />
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="max-lg:w-full"
          onClick={onEnough}
          disabled={busy}
        >
          {t('first.enough')}
        </Button>
      </Bar>
    </div>
  );
}

export function Results({
  results,
  canAskMore,
  onMore,
  onEdit,
  consulting,
  onConsult,
}: {
  results: PathwayResult[];
  canAskMore: boolean;
  onMore: () => void;
  onEdit: () => void;
  consulting: boolean;
  onConsult: () => void;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const fitting = results.filter((r) => r.eligible).slice(0, 3);
  const others = results.filter((r) => !fitting.includes(r));
  return (
    <div className="flex animate-rise flex-col gap-10">
      <header className="flex flex-col">
        <p className="m-0 text-label font-semibold text-primary-text lg:text-small">
          {t('results.eyebrow')}
        </p>
        <h1 className="m-0 mt-1.5 text-title font-extrabold tracking-tight text-balance lg:mt-3">
          {fitting.length ? t('results.title', { count: fitting.length }) : t('results.none')}
        </h1>
        {fitting.length > 0 && (
          <p className="m-0 mt-2 max-w-2xl text-lead text-text-2 lg:mt-4">{t('results.intro')}</p>
        )}
      </header>
      {fitting.length > 0 && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {fitting.map((result, index) => (
            <RouteCard key={result.pathway.id} result={result} lead={index === 0} />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <section className="flex flex-col">
          <h2 className="m-0 mb-2 text-xl font-bold">{t('results.not_now')}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {others.map((result) => (
              <li
                key={result.pathway.id}
                className="flex flex-col gap-1 border-b border-hair py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6"
              >
                <span className="flex items-center gap-3 text-base">
                  <SmallFlag
                    code={result.pathway.country.code}
                    name={result.pathway.country.name}
                  />
                  {t('peek.route', {
                    country: result.pathway.country.name,
                    name: result.pathway.name,
                  })}
                </span>
                <span className="text-sm text-text-2">
                  {f.list(result.missing) || t('results.points_short')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="grid items-center gap-6 rounded-3xl bg-primary p-6 text-on-primary lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10 lg:p-10">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-2xl leading-snug font-bold tracking-tight lg:text-3xl">
            {t('consult.title')}
          </h2>
          <p className="m-0 text-base leading-8 opacity-90">{t('consult.body')}</p>
        </div>
        <Button
          variant="outline"
          size="lg"
          className="text-primary-text"
          onClick={onConsult}
          disabled={consulting}
        >
          {t('consult.button')}
        </Button>
      </section>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          {canAskMore && (
            <Button variant="outline" size="lg" onClick={onMore}>
              {t('results.more')}
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={onEdit}>
            <QuizIcon name="restart" size={18} />
            {t('results.edit')}
          </Button>
        </div>
        <p className="m-0 text-label text-text-2">{t('results.disclaimer')}</p>
      </div>
    </div>
  );
}
