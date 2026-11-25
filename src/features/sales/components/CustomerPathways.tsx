import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Flag } from '@/components/applicant/pathways/art';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import type { CustomerPathwayCheck, CustomerPathwayRoute, PathwayAnswer } from '../api';

/** Factors whose values are names the pathways namespace words (`choices.<factor>.<value>`). */
const CHOICE_FACTORS = new Set([
  'education',
  'recognition',
  'english_level',
  'german_level',
  'partner',
  'nomination',
]);

/** The answers tab's groups, in order; a factor not listed goes in the last one. */
const GROUPS = {
  education: ['education', 'gpa', 'recognition'],
  languageWork: [
    'english_ielts',
    'english_level',
    'german_level',
    'work_years',
    'skills_assessment',
  ],
  personal: ['age', 'partner', 'children', 'monthly_income_eur', 'remote_work'],
  other: [] as string[],
} as const;
type Group = keyof typeof GROUPS;

type Verdict = 'qualifies' | 'eligible' | 'not';
const VERDICT_TONE: Record<Verdict, ChipTone> = {
  qualifies: 'good',
  eligible: 'warn',
  not: 'neutral',
};
const BANDS = ['low', 'medium', 'high'] as const;

const verdictOf = (route: CustomerPathwayRoute): Verdict =>
  route.qualifies ? 'qualifies' : route.eligible ? 'eligible' : 'not';
/** Not passed yet, but one step the finder named passes it. */
const isNear = (route: CustomerPathwayRoute) =>
  !route.qualifies && (route.improvements ?? []).some((step) => step.passes);

/** The English option of the finder an IELTS band falls in (its label says the range). */
function englishOption(band: number) {
  return band >= 8.5
    ? 'ielts_8_5'
    : band >= 7
      ? 'ielts_7'
      : band >= 5.5
        ? 'ielts_5_5'
        : band >= 4
          ? 'ielts_4'
          : 'none';
}
const gpaOption = (gpa: number) =>
  gpa >= 18 ? '18_plus' : gpa >= 16 ? '16_18' : gpa >= 14 ? '14_16' : 'below_14';

/** Where the finder lives for customers: the link a seller sends. */
const finderLink = () => `${window.location.origin}/panel/pathways`;

/**
 * The customer's latest pathway quiz on the summary tab (canvas "Seller pathway card", Main): the
 * best route first with its score, three numbers, then every route (open one for its points, what
 * it misses and the next step, or for a study route its chance of admission and costs) or the
 * answers beside what the profile says. A record of the quiz only: the profile is changed on the
 * details tab.
 */
export function CustomerPathways({
  check,
  customer,
}: {
  check: CustomerPathwayCheck;
  customer: number;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [tab, setTab] = useState<'routes' | 'chances' | 'answers'>('routes');
  const routes = check.results;
  const best = routes.find((route) => route.qualifies);
  const fitting = routes.filter((route) => route.qualifies).length;
  const near = routes.filter(isNear);
  const admitted = routes
    .filter((route) => route.admission)
    .sort(
      (a, b) =>
        BANDS.indexOf(b.admission?.band ?? 'low') - BANDS.indexOf(a.admission?.band ?? 'low'),
    )[0];
  // The best chance: from the insights (every country with outcomes), else a study route's.
  const topChance =
    check.insights?.countries[0] ??
    (admitted?.admission && {
      band: admitted.admission.band,
      country: admitted.country,
    });
  const differing = [...check.answers, ...check.by_country.flatMap((row) => row.answers)].filter(
    (answer) => answer.matches === false,
  ).length;

  return (
    <SectionCard
      id="customer-pathways"
      variant="panel"
      title={t('customer.pathways.title')}
      subtitle={t('customer.pathways.taken', { date: f.date(check.created_at) })}
      end={
        <ChoiceGroup
          legend={t('customer.pathways.view')}
          hideLegend
          look="segmented"
          options={[
            { value: 'routes', label: t('customer.pathways.tabs.routes') },
            ...(check.insights
              ? [{ value: 'chances' as const, label: t('customer.pathways.tabs.chances') }]
              : []),
            { value: 'answers', label: t('customer.pathways.tabs.answers') },
          ]}
          value={tab}
          onChange={setTab}
        />
      }
    >
      {best && <BestRoute route={best} />}

      <dl className="m-0 grid grid-cols-3 gap-2.5">
        <Number label={t('customer.pathways.numbers.fits')}>
          {f.number(fitting)}{' '}
          <span className="text-small font-medium text-text-2">
            {t('customer.pathways.numbers.of', { n: f.number(routes.length) })}
          </span>
        </Number>
        <Number label={t('customer.pathways.numbers.near')}>
          {f.number(near.length)}
          {near[0] && (
            <span className="text-small font-medium text-text-2"> {near[0].country}</span>
          )}
        </Number>
        <Number label={t('customer.pathways.numbers.admission')}>
          {topChance ? (
            <>
              <span className={topChance.band === 'high' ? 'text-good' : ''}>
                {t(`customer.pathways.band.${topChance.band}`)}
              </span>
              <span className="text-small font-medium text-text-2"> {topChance.country}</span>
            </>
          ) : (
            <span className="text-text-2">{t('customer.pathways.numbers.none')}</span>
          )}
        </Number>
      </dl>

      {tab === 'routes' ? (
        <Routes routes={routes} />
      ) : tab === 'chances' && check.insights ? (
        <Chances insights={check.insights} />
      ) : (
        <Answers check={check} customer={customer} differing={differing} />
      )}

      <CallNote best={best} near={near[0]} admitted={admitted} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-sm text-caption leading-6 text-text-2">
          {t('customer.pathways.note')}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard
              .writeText(finderLink())
              .then(() => toast.success(t('customer.pathways.copied')))
              .catch(() => toast.error(t('customer.pathways.copyFailed')));
          }}
        >
          {t('customer.pathways.copyLink')}
        </Button>
      </div>
    </SectionCard>
  );
}

const CHANCE_TONE = { high: 'good', medium: 'warn', low: 'neutral' } as const;
const CHANCE_FILL = {
  high: 'w-full bg-good',
  medium: 'w-2/3 bg-warn',
  low: 'w-1/3 bg-neutral',
} as const;

/**
 * The insights tab: the chance of admission per country from Scorize's own decided applications,
 * for the degree they would study and their background (worked out when the page opens, so it
 * follows the nightly rebuild), with the newest accepted applicants like them.
 */
function Chances({ insights }: { insights: NonNullable<CustomerPathwayCheck['insights']> }) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="m-0 text-small font-extrabold">{t('customer.pathways.chances.title')}</h3>
        <span className="text-caption text-text-2">
          {t(
            insights.gpa_from === 'profile'
              ? 'customer.pathways.chances.forProfile'
              : 'customer.pathways.chances.for',
            {
              degree: tc(`degree.${insights.degree}`),
              gpa: f.number(insights.gpa),
            },
          )}
        </span>
      </div>
      <ul aria-label={t('customer.pathways.chances.title')} className="m-0 list-none p-0">
        {insights.countries.map((row) => (
          <li
            key={row.country}
            className="flex flex-col gap-2 border-b border-hair px-2 py-3.5 last:border-b-0"
          >
            <div className="flex items-center gap-3.5">
              <span className="size-10 flex-none overflow-hidden rounded-xl border border-hair">
                <Flag code={row.code} name={row.country} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-body font-bold">{row.country}</span>
                <span className="text-caption text-text-2">
                  {t('customer.pathways.detail.decided', { n: f.number(row.decided) })}
                </span>
              </span>
              <span className="flex w-36 flex-none flex-col items-end gap-2">
                <Chip tone={CHANCE_TONE[row.band]} dot small>
                  {row.chance === null
                    ? t(`customer.pathways.admissionShort.${row.band}`)
                    : t('customer.pathways.chances.percent', { n: f.number(row.chance) })}
                </Chip>
                <span aria-hidden="true" className="block h-1.5 w-full rounded-full bg-track">
                  <span className={`block h-full rounded-full ${CHANCE_FILL[row.band]}`} />
                </span>
              </span>
            </div>
            {row.similar.length > 0 && (
              <ul
                aria-label={t('customer.pathways.chances.similar', { country: row.country })}
                className="m-0 flex list-none flex-wrap gap-1.5 p-0 ps-[54px]"
              >
                {row.similar.map((one) => (
                  <li
                    key={`${one.university}-${String(one.year)}-${one.field ?? ''}`}
                    className="rounded-lg bg-canvas px-2.5 py-1 text-caption"
                    dir="auto"
                  >
                    {[one.university, one.field, f.digits(String(one.year))]
                      .filter(Boolean)
                      .join(' · ')}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="m-0 text-caption leading-6 text-text-2">
        {t('customer.pathways.chances.note')}
      </p>
    </div>
  );
}

function Number({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-canvas px-4 py-3.5">
      <dt className="text-caption text-text-2">{label}</dt>
      <dd className="m-0 truncate text-section font-extrabold">{children}</dd>
    </div>
  );
}

/** The best route: a score ring (or a tick without a pass mark), its name and what it means. */
function BestRoute({ route }: { route: CustomerPathwayRoute }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const scored = route.pass_mark !== null && route.pass_mark > 0;
  const extra = scored ? route.points - (route.pass_mark ?? 0) : 0;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-good/25 p-4 lg:p-5">
      <span className="relative flex size-[76px] flex-none items-center justify-center text-good">
        <svg aria-hidden="true" viewBox="0 0 76 76" className="absolute inset-0 size-full">
          <circle cx="38" cy="38" r="33" fill="none" stroke="currentColor" strokeWidth="7" />
        </svg>
        {scored ? (
          <span className="flex flex-col items-center leading-tight">
            <span className="text-section font-extrabold">{f.number(route.points)}</span>
            <span className="text-caption text-text-2">
              {t('customer.pathways.best.of', { n: f.number(route.pass_mark ?? 0) })}
            </span>
          </span>
        ) : (
          <Icon name="check" size={26} />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-caption font-bold text-good">
          {t('customer.pathways.best.eyebrow')}
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-section font-extrabold">
            {t('customer.pathways.route', { country: route.country, pathway: route.pathway })}
          </span>
          <Chip tone="good" dot small>
            {t('customer.pathways.verdict.qualifies')}
          </Chip>
        </div>
        <span className="text-small leading-7 text-text-2">
          {extra > 0
            ? t('customer.pathways.best.extra', { n: f.number(extra) })
            : route.admission
              ? t('customer.pathways.best.admission', {
                  band: t(`customer.pathways.band.${route.admission.band}`),
                })
              : t('customer.pathways.best.plain')}
        </span>
      </div>
    </div>
  );
}

function Routes({ routes }: { routes: CustomerPathwayRoute[] }) {
  const { t } = useTranslation('sales');
  const [open, setOpen] = useState<number | null>(0);
  if (routes.length === 0)
    return <p className="m-0 text-small text-text-2">{t('customer.pathways.noRoutes')}</p>;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-small font-extrabold">{t('customer.pathways.routes')}</h3>
        <span className="text-caption text-text-2">{t('customer.pathways.sorted')}</span>
      </div>
      <ul aria-label={t('customer.pathways.routes')} className="m-0 list-none p-0">
        {routes.map((route, index) => (
          <RouteRow
            key={`${route.country}-${route.pathway}`}
            route={route}
            open={open === index}
            onToggle={() => setOpen(open === index ? null : index)}
          />
        ))}
      </ul>
    </div>
  );
}

function RouteRow({
  route,
  open,
  onToggle,
}: {
  route: CustomerPathwayRoute;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const verdict = verdictOf(route);
  const near = isNear(route);
  const max = route.max_points || route.pass_mark || 0;
  const scored = route.pass_mark !== null && route.pass_mark > 0 && max > 0;
  return (
    <li className="border-b border-hair last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="grid min-h-11 w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)_auto_18px] items-center gap-3.5 rounded-xl px-2 py-3.5 text-start hover:bg-canvas lg:grid-cols-[40px_minmax(0,1fr)_160px_18px]"
      >
        <span className="size-10 overflow-hidden rounded-xl border border-hair">
          <Flag code={route.code} name={route.country} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="text-body font-bold">{route.country}</span>
            <span className="rounded-md bg-neutral-tint px-2 py-0.5 text-caption font-bold text-neutral">
              {t(`customer.pathways.goal.${route.goal}`)}
            </span>
          </span>
          <span className="truncate text-small text-text-2">{route.pathway}</span>
        </span>
        <span className="flex flex-col items-end gap-2">
          <Chip tone={near ? 'warn' : VERDICT_TONE[verdict]} dot small>
            {t(near ? 'customer.pathways.verdict.near' : `customer.pathways.verdict.${verdict}`)}
          </Chip>
          {scored ? (
            <span className="flex w-full flex-col gap-1 max-lg:hidden">
              <ProgressBar
                size="sm"
                value={Math.min(100, (route.points / max) * 100)}
                mark={((route.pass_mark ?? 0) / max) * 100}
                tone={route.qualifies ? 'good' : 'warn'}
                label={t('customer.pathways.points', {
                  points: f.number(route.points),
                  pass: f.number(route.pass_mark ?? 0),
                })}
              />
            </span>
          ) : route.admission ? (
            <span className="text-caption text-text-2">
              {t(`customer.pathways.admissionShort.${route.admission.band}`)}
            </span>
          ) : null}
        </span>
        <Icon
          name="chevronDown"
          size={18}
          className={`text-text-2 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <RouteDetails route={route} />}
    </li>
  );
}

function Detail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-caption font-bold text-text-2">{title}</span>
      <div className="text-small leading-7">{children}</div>
    </div>
  );
}

/** An open route: points and what it misses, or a study route's admission and costs; the next step. */
function RouteDetails({ route }: { route: CustomerPathwayRoute }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const scored = route.pass_mark !== null && route.pass_mark > 0;
  const steps = route.improvements ?? [];
  const billions = (value: number) => f.number(Math.round(value / 100_000_000) / 10);
  return (
    <div className="mx-2 mb-4 grid gap-4 rounded-2xl bg-canvas p-4 sm:grid-cols-2">
      {scored && (
        <Detail title={t('customer.pathways.detail.points')}>
          {t('customer.pathways.points', {
            points: f.number(route.points),
            pass: f.number(route.pass_mark ?? 0),
          })}
          {(route.scores ?? []).length > 0 && (
            <span className="block text-text-2">
              {f.list(
                (route.scores ?? [])
                  .filter((row) => row.points > 0)
                  .map((row) =>
                    t('customer.pathways.detail.score', {
                      label: row.label,
                      n: f.number(row.points),
                    }),
                  ),
              )}
            </span>
          )}
        </Detail>
      )}
      {route.admission && (
        <Detail title={t('customer.pathways.detail.admission')}>
          {t(`customer.pathways.band.${route.admission.band}`)}
          {route.admission.chance !== null &&
            ` · ${t('customer.pathways.detail.percent', { n: f.number(route.admission.chance) })}`}
          {route.admission.decided ? (
            <span className="block text-text-2">
              {t('customer.pathways.detail.decided', { n: f.number(route.admission.decided) })}
            </span>
          ) : null}
          {(route.admission.universities ?? []).length > 0 && (
            <span className="block text-text-2" dir="auto">
              {t('customer.pathways.detail.similar', {
                list: f.list(route.admission.universities ?? []),
              })}
            </span>
          )}
        </Detail>
      )}
      {route.study?.first_year_toman && (
        <Detail title={t('customer.pathways.detail.cost')}>
          {t('customer.pathways.detail.costRange', {
            min: billions(route.study.first_year_toman.min),
            max: billions(route.study.first_year_toman.max),
          })}
          {route.study.budget_fit && route.study.budget_fit !== 'unknown' && (
            <span className="block text-text-2">
              {t(`customer.pathways.detail.fit.${route.study.budget_fit}`)}
            </span>
          )}
        </Detail>
      )}
      <Detail
        title={t(
          route.missing.length > 0
            ? 'customer.pathways.detail.missing'
            : 'customer.pathways.detail.next',
        )}
      >
        {route.missing.length > 0
          ? f.list(route.missing)
          : steps.length === 0 && t('customer.pathways.detail.nothing')}
        {steps.map((step) => (
          <span key={step.label} className="block">
            {t(
              step.passes ? 'customer.pathways.detail.stepPasses' : 'customer.pathways.detail.step',
              { step: step.label, n: f.number(step.points) },
            )}
          </span>
        ))}
        {route.needs_licensed_agent && (
          <span className="block text-text-2">{t('customer.pathways.detail.agent')}</span>
        )}
      </Detail>
    </div>
  );
}

/** The answers by group, each beside what the profile says. */
function Answers({
  check,
  customer,
  differing,
}: {
  check: CustomerPathwayCheck;
  customer: number;
  differing: number;
}) {
  const { t } = useTranslation('sales');
  const { t: tp } = useTranslation('pathways');
  const f = useFormat();

  const show = (factor: string, value: PathwayAnswer['value'], fromProfile = false): string => {
    if (typeof value === 'boolean')
      return t(value ? 'customer.pathways.yes' : 'customer.pathways.no');
    if (typeof value === 'number') {
      if (factor === 'english_ielts')
        return fromProfile
          ? t('customer.pathways.ielts', { n: f.number(value) })
          : tp(`asks.english.options.${englishOption(value)}`);
      if (factor === 'gpa')
        return fromProfile ? f.number(value) : tp(`asks.gpa.options.${gpaOption(value)}`);
      if (factor === 'work_years') return t('customer.pathways.years', { n: f.number(value) });
      return f.number(value);
    }
    if (CHOICE_FACTORS.has(factor))
      return tp(`choices.${factor}.${value}`, { defaultValue: value });
    return value;
  };
  const label = (factor: string) =>
    factor === 'gpa'
      ? t('customer.pathways.gpa')
      : tp(`factors.${factor}`, { defaultValue: factor });

  type Row = { key: string; label: string; value: string; answer?: PathwayAnswer };
  const groups: Record<Group, Row[]> = { education: [], languageWork: [], personal: [], other: [] };
  const groupOf = (factor: string) =>
    (Object.keys(GROUPS) as Group[]).find((group) =>
      (GROUPS[group] as readonly string[]).includes(factor),
    ) ?? 'other';
  for (const answer of check.answers)
    groups[groupOf(answer.factor)].push({
      key: answer.factor,
      label: label(answer.factor),
      value: show(answer.factor, answer.value),
      answer,
    });
  if (check.field_group)
    groups.education.push({
      key: 'field_group',
      label: tp('factors.field_group'),
      value: check.field_group,
    });
  if (check.occupation)
    groups.languageWork.push({
      key: 'occupation',
      label: t('customer.pathways.occupation'),
      value: check.occupation.name,
    });
  if (check.budget)
    groups.personal.push({
      key: 'budget',
      label: t('customer.pathways.budget'),
      value: tp(`asks.budget.options.${check.budget}`, { defaultValue: check.budget }),
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-small font-extrabold">{t('customer.pathways.answers')}</h3>
        {differing > 0 && (
          <Chip tone="warn" small>
            {t('customer.pathways.differ', { n: f.number(differing) })}
          </Chip>
        )}
      </div>
      {(Object.keys(groups) as Group[])
        .filter((group) => groups[group].length > 0)
        .map((group) => (
          <div key={group} className="flex flex-col gap-2">
            <span className="text-caption font-bold text-text-2">
              {t(`customer.pathways.groups.${group}`)}
            </span>
            <dl className="m-0 grid gap-2 sm:grid-cols-2">
              {groups[group].map((row) => {
                const differs = row.answer?.matches === false;
                return (
                  <div
                    key={row.key}
                    className={`flex flex-col gap-0.5 rounded-xl border px-3.5 py-3 ${
                      differs ? 'border-warn/30 bg-warn-tint' : 'border-transparent bg-canvas'
                    }`}
                  >
                    <dt className="text-caption text-text-2">{row.label}</dt>
                    <dd className="m-0 text-body font-bold">{row.value}</dd>
                    {differs && row.answer?.profile != null && (
                      <span className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-caption text-warn">
                          {t('customer.pathways.inProfile', {
                            value: show(row.key, row.answer.profile, true),
                          })}
                        </span>
                        <Link
                          to={`/sales/customers/${String(customer)}/info`}
                          className="inline-flex min-h-8 items-center text-caption font-bold text-primary-text"
                        >
                          {t('customer.pathways.editProfile')}
                        </Link>
                      </span>
                    )}
                    {row.answer?.matches === true && (
                      <span className="mt-1 flex items-center gap-1 text-caption text-good">
                        <Icon name="check" size={14} />
                        {t('customer.pathways.same')}
                      </span>
                    )}
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      {check.by_country.map((row) => (
        <div key={row.country} className="flex flex-col gap-1">
          <span className="text-caption font-bold text-text-2">
            {t('customer.pathways.about', { country: row.country })}
          </span>
          <span className="text-small">
            {f.list(
              row.answers.map((answer) =>
                t('customer.pathways.pair', {
                  label: label(answer.factor),
                  value: show(answer.factor, answer.value),
                }),
              ),
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** What to say on the call, from the results: the best route, the near one's step, the best chance. */
function CallNote({
  best,
  near,
  admitted,
}: {
  best: CustomerPathwayRoute | undefined;
  near: CustomerPathwayRoute | undefined;
  admitted: CustomerPathwayRoute | undefined;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const step = near?.improvements?.find((one) => one.passes);
  const lines = [
    best && t('customer.pathways.call.best', { route: `${best.country} · ${best.pathway}` }),
    near &&
      step &&
      t('customer.pathways.call.near', {
        country: near.country,
        step: step.label,
        n: f.number(step.points),
      }),
    admitted?.admission &&
      admitted !== best &&
      t('customer.pathways.call.admission', {
        country: admitted.country,
        band: t(`customer.pathways.band.${admitted.admission.band}`),
      }),
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-tint p-4">
      <Icon name="phone" size={20} className="mt-0.5 flex-none text-primary-text" />
      <div className="flex flex-col gap-1">
        <span className="text-small font-extrabold text-primary-text">
          {t('customer.pathways.call.title')}
        </span>
        <span className="text-small leading-7">{lines.join(' ')}</span>
      </div>
    </div>
  );
}
