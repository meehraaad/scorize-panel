import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { FIRST_CALL_TARGET_MINUTES } from '@/lib/sales/api';
import { toast } from '@/lib/toast';
import { useMonthUnlock, type MonthData } from './api';
import { useSalesFormat } from './format';

const FUNNEL = ['leads', 'reached', 'consulted', 'offered', 'won'] as const;
const SOURCE_COLUMNS = ['source', 'leads', 'won', 'rate'] as const;

/**
 * The seller's month: goal, funnel, first-call speed, which sources convert. Canvas "ماه من".
 * Opens only after the seller types their password, on every visit (nothing is kept in a cache).
 */
export default function MonthPage() {
  const { t } = useTranslation('sales');
  const unlock = useMonthUnlock();
  return unlock.data ? (
    <Month data={unlock.data} />
  ) : (
    <PasswordGate
      pending={unlock.isPending}
      error={unlock.error}
      onSubmit={(password) => {
        unlock.mutate(password, {
          onError: (error) => {
            if (!(error instanceof ApiError && [400, 409, 429].includes(error.status)))
              toast.error(t('month.lock.failed'));
          },
        });
      }}
    />
  );
}

/** Asks for the account's password before the month (commission, rank) is shown. */
function PasswordGate({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error: Error | null;
  onSubmit: (password: string) => void;
}) {
  const { t } = useTranslation('sales');
  const user = useUser();
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState(false);
  const status = error instanceof ApiError ? error.status : null;

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    setMissing(!password);
    if (password) onSubmit(password);
  };

  return (
    <PageStack>
      <PageHeader title={t('month.lock.title')} subtitle={t('month.lock.subtitle')} />
      <SectionCard variant="panel" id="month-lock" title={t('month.lock.card')}>
        {status === 409 ? (
          <Notice tone="warn">{t('month.lock.noPassword')}</Notice>
        ) : (
          <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-4">
            {/* Lets password managers fill the right account. */}
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={user.email ?? ''}
              readOnly
              hidden
            />
            <TextField
              label={t('month.lock.password')}
              name="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              autoFocus
              value={password}
              error={
                missing
                  ? t('month.lock.required')
                  : status === 400
                    ? t('month.lock.wrong')
                    : status === 429
                      ? t('month.lock.tooMany')
                      : undefined
              }
              onChange={(event) => {
                setPassword(event.target.value);
                setMissing(false);
              }}
            />
            <Button type="submit" disabled={pending} aria-busy={pending} className="self-start">
              {t('month.lock.submit')}
            </Button>
          </form>
        )}
      </SectionCard>
    </PageStack>
  );
}

function Month({ data }: { data: MonthData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const remaining = Math.max(0, data.target - data.won);
  const rate = data.funnel.leads ? data.funnel.won / data.funnel.leads : 0;
  const leadsNeeded = rate > 0 ? Math.ceil(remaining / rate) : 0;

  return (
    <PageStack>
      <PageHeader
        title={t('month.title', { month: f.monthYear(data.month) })}
        subtitle={
          data.target <= 0
            ? t('month.targetUnset')
            : remaining <= 0
              ? t('month.subtitleDone')
              : rate > 0
                ? t('month.subtitle', { n: f.number(remaining), leads: f.number(leadsNeeded) })
                : t('month.subtitleNoConversion', { n: f.number(remaining) })
        }
      />
      <Goal data={data} />
      <PageColumns
        asideLabel={t('month.speed.title')}
        main={<Funnel data={data} />}
        aside={<Speed weeks={data.weeks} />}
      />
      <Sources data={data} />
    </PageStack>
  );
}

function Goal({ data }: { data: MonthData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const share = data.target > 0 ? Math.min(1, data.won / data.target) : 0;
  const tiles = [
    { label: t('month.sales'), value: s.millions(data.sales) },
    {
      label: t('month.commission'),
      value: data.commission === null ? t('month.commissionUnset') : s.millions(data.commission),
    },
    { label: t('month.drafts'), value: f.number(data.drafts_waiting) },
    {
      label: t('month.rank'),
      value: t('month.rankValue', {
        position: f.number(data.rank.position),
        of: f.number(data.rank.of),
      }),
    },
  ];
  return (
    <section
      aria-label={t('month.goal')}
      className="grid gap-6 rounded-card-sm bg-hero p-5 text-on-hero shadow-hero lg:grid-cols-[1.4fr_1fr] lg:rounded-[32px] lg:p-9"
    >
      <div className="flex flex-col gap-3">
        <span className="text-sm text-on-hero-2">{t('month.won')}</span>
        <span className="flex items-baseline gap-2 font-display">
          <span className="text-5xl font-bold tabular-nums">{f.number(data.won)}</span>
          <span className="text-base text-on-hero-2">
            {data.target > 0
              ? t('month.ofTarget', { n: f.number(data.target) })
              : t('month.targetUnset')}
          </span>
        </span>
        {data.target > 0 && (
          <div
            role="progressbar"
            aria-label={t('month.progress', {
              won: f.number(data.won),
              target: f.number(data.target),
            })}
            aria-valuemin={0}
            aria-valuemax={data.target}
            aria-valuenow={data.won}
            className="relative h-3 rounded-full bg-hero-line"
          >
            <div
              className="h-3 rounded-full bg-on-hero"
              style={{ width: `${String(share * 100)}%` }}
            />
            <div
              aria-hidden="true"
              className="absolute -top-1 h-5 w-0.5 rounded-full bg-hero-current"
              style={{ insetInlineStart: `${String(data.elapsed * 100)}%` }}
            />
          </div>
        )}
        <span className="text-sm leading-7 text-on-hero-2">
          {data.target > 0
            ? t('month.marker', {
                percent: s.percent(data.elapsed),
                days: f.number(data.working_days_left),
              })
            : t('month.workingDaysLeft', { days: f.number(data.working_days_left) })}
        </span>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-1.5 rounded-2xl bg-hero-raised px-4 py-3"
          >
            <dt className="text-xs text-on-hero-2">{tile.label}</dt>
            <dd className="m-0 text-lg font-bold">{tile.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Funnel({ data }: { data: MonthData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const values = FUNNEL.map((step) => data.funnel[step]);
  const top = values[0] || 1;
  // The step after the biggest drop between two neighbouring steps.
  let drop = 0;
  for (let index = 1; index < values.length; index++)
    if (lossOf(values, index) > lossOf(values, drop)) drop = index;
  return (
    <SectionCard
      id="month-funnel"
      variant="panel"
      size="lg"
      title={t('month.funnel.title')}
      subtitle={
        drop > 0 &&
        t('month.funnel.drop', {
          from: t(`month.funnel.step.${FUNNEL[drop - 1] ?? 'leads'}`),
          to: t(`month.funnel.step.${FUNNEL[drop] ?? 'won'}`),
        })
      }
    >
      <dl className="m-0 flex flex-col gap-3">
        {FUNNEL.map((step, index) => (
          <div key={step} className="grid grid-cols-[90px_1fr_40px] items-center gap-3">
            <dt className="text-sm text-text-2">{t(`month.funnel.step.${step}`)}</dt>
            <dd className="m-0 h-7 rounded-md bg-track">
              <div
                className={`h-7 rounded-md ${index === FUNNEL.length - 1 ? 'bg-primary' : 'bg-hero-accent'}`}
                style={{ width: `${String(((values[index] ?? 0) / top) * 100)}%` }}
              />
            </dd>
            <dd className="m-0 text-end text-sm font-bold tabular-nums">
              {f.number(values[index] ?? 0)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-sm text-text-2">
        {t('month.funnel.rate', {
          mine: s.percent(data.funnel.leads ? data.funnel.won / data.funnel.leads : 0),
          team: s.percent(data.team_conversion),
        })}
      </p>
    </SectionCard>
  );
}

/** Share lost between step `index - 1` and `index` (0 for the first step). */
function lossOf(values: readonly number[], index: number) {
  if (index === 0) return 0;
  const before = values[index - 1] ?? 0;
  return before ? 1 - (values[index] ?? 0) / before : 0;
}

function Speed({ weeks }: { weeks: MonthData['weeks'] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const max = Math.max(FIRST_CALL_TARGET_MINUTES, ...weeks.filter((value) => value !== null));
  const items = weeks.map((minutes, index) =>
    minutes === null
      ? t('month.speed.itemNoData', { n: f.number(index + 1) })
      : t('month.speed.item', { n: f.number(index + 1), minutes: f.number(minutes) }),
  );
  return (
    <SectionCard
      id="month-speed"
      variant="panel"
      title={t('month.speed.title')}
      subtitle={t('month.speed.subtitle')}
    >
      <div
        role="img"
        aria-label={t('month.speed.chart', {
          list: f.list(items),
          goal: f.number(FIRST_CALL_TARGET_MINUTES),
        })}
        className="relative flex h-48 items-end gap-4 pt-6"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 border-t-2 border-dashed border-good"
          // The bars' baseline sits above the week labels (24px).
          style={{ bottom: `${String((FIRST_CALL_TARGET_MINUTES / max) * 140 + 24)}px` }}
        />
        {weeks.map((minutes, index) => (
          <div key={index} aria-hidden="true" className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-xs font-bold tabular-nums">
              {minutes === null
                ? t('month.speed.noData')
                : t('month.speed.value', { n: f.number(minutes) })}
            </span>
            {minutes !== null && (
              <div
                className={`w-full max-w-12 rounded-t ${minutes <= FIRST_CALL_TARGET_MINUTES ? 'bg-good' : 'bg-primary'}`}
                style={{ height: `${String((minutes / max) * 140)}px` }}
              />
            )}
            <span className="text-xs text-text-2">
              {t('month.speed.week', { n: f.number(index + 1) })}
            </span>
          </div>
        ))}
      </div>
      <span aria-hidden="true" className="flex items-center gap-2 text-xs text-good">
        <span className="w-6 border-t-2 border-dashed border-good" />
        {t('month.speed.goal', { n: f.number(FIRST_CALL_TARGET_MINUTES) })}
      </span>
    </SectionCard>
  );
}

function Sources({ data }: { data: MonthData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const best = Math.max(0.01, ...data.sources.map((row) => (row.leads ? row.won / row.leads : 0)));
  return (
    <SectionCard
      id="month-sources"
      title={t('month.sources.title')}
      subtitle={t('month.sources.subtitle')}
    >
      <div className="overflow-x-auto pb-3">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="text-[13px] text-text-2">
              {SOURCE_COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-3 py-2 text-start font-medium first:ps-5 last:pe-5 lg:first:ps-8 lg:last:pe-8"
                >
                  {t(`month.sources.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sources.map((row) => {
              const rate = row.leads ? row.won / row.leads : 0;
              return (
                <tr key={row.source} className="shadow-[inset_0_1px_0_var(--hair)]">
                  <th
                    scope="row"
                    className="px-3 py-3.5 ps-5 text-start text-[15px] font-medium lg:ps-8"
                  >
                    {t(`source.${row.source}`)}
                  </th>
                  <td className="px-3 py-3.5 text-sm tabular-nums">{f.number(row.leads)}</td>
                  <td className="px-3 py-3.5 text-sm tabular-nums">{f.number(row.won)}</td>
                  <td className="px-3 py-3.5 pe-5 lg:pe-8">
                    <span className="flex items-center gap-3">
                      <span aria-hidden="true" className="h-2 w-32 rounded-full bg-track">
                        <span
                          className="block h-2 rounded-full bg-primary"
                          style={{ width: `${String((rate / best) * 100)}%` }}
                        />
                      </span>
                      <span className="text-sm font-bold tabular-nums">{s.percent(rate)}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
