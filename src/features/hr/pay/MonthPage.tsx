import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { Avatar } from '@/components/ui/Avatar';
import { hrPath } from '../paths';
import {
  firstDayOf,
  MANUAL,
  payMonth,
  payrollExportUrl,
  payrollQuery,
  resultsQuery,
  type Kpi,
  type KpiResults,
  type PayMonth,
  type Payroll,
  type ResultRow,
  type Slip,
} from './api';
import { Disputes } from './components/Disputes';
import {
  useFinalPayroll,
  useReopenMonth,
  useSaveResults,
  useShowMonth,
  useStartPayroll,
} from './mutations';
import { parseNumber } from './numbers';

const PersonSheet = lazy(() => import('./components/PersonSheet'));

/** A manual value nobody has entered yet. */
interface Missing {
  row: ResultRow;
  kpi: Kpi;
}

/** The month's step: 0 the numbers are checked, 1 staff see them, 2 paid. */
type Step = 0 | 1 | 2;
const STATES = ['check', 'shown', 'paid'] as const;

/**
 * «ماه» (canvas "حقوق و پاداش ساده"): a month's scores and pay on one page, in three steps
 * (check the numbers, show staff, pay). What still needs a hand (manual values, objections) sits
 * above one table of everyone's score and pay; a row opens the person's slip. Last month by
 * default: that is the one to pay. A month that has begun and isn't paid has its pay worked out
 * as a draft, so the numbers are there from the start.
 */
export default function MonthPage() {
  const [shift, setShift] = useState(-1);
  const month = payMonth(shift);
  const results = useQuery(resultsQuery(month));
  const payroll = useQuery(payrollQuery(month));
  useDraftPay(month, shift, results.data, payroll.data);
  return (
    <div className="flex flex-col gap-5">
      {!results.data || !payroll.data ? (
        <Card className="p-5">
          <SkeletonRows rows={6} />
        </Card>
      ) : (
        <Month
          key={`${String(month.year)}-${String(month.month)}`}
          month={month}
          shift={shift}
          onShift={setShift}
          results={results.data}
          payroll={payroll.data}
        />
      )}
    </div>
  );
}

/** Works a month's pay out as a draft once, when it has begun and has none yet. */
function useDraftPay(
  month: PayMonth,
  shift: number,
  results: KpiResults | undefined,
  payroll: Payroll | undefined,
) {
  const start = useStartPayroll();
  const asked = useRef(new Set<string>());
  const key = `${String(month.year)}-${String(month.month)}`;
  const needed = shift <= 0 && !!results && !!payroll && payroll.id === null && !results.final;
  useEffect(() => {
    if (!needed || asked.current.has(key)) return;
    asked.current.add(key);
    start.mutate(month);
  }, [needed, key, month, start]);
}

function Month({
  month,
  shift,
  onShift,
  results,
  payroll,
}: {
  month: PayMonth;
  shift: number;
  onShift: (shift: number) => void;
  results: KpiResults;
  payroll: Payroll;
}) {
  const { t } = useTranslation('hr');
  const [open, setOpen] = useState<number | null>(null);
  const kpis = new Map(results.kpis.map((kpi) => [kpi.id, kpi]));
  const rows = new Map(results.rows.map((row) => [row.staff.id, row]));
  const missing: Missing[] = results.rows.flatMap((row) =>
    row.kpis.flatMap((id) => {
      const kpi = kpis.get(id);
      return kpi && kpi.metric === MANUAL && !kpi.trial && row.results[String(id)] === undefined
        ? [{ row, kpi }]
        : [];
    }),
  );
  const openDisputes = results.disputes.filter((row) => row.status === 'open').length;
  const step: Step = payroll.status === 'final' || results.final ? 2 : results.closed ? 1 : 0;
  const opened = open === null ? undefined : payroll.slips.find((slip) => slip.id === open);

  return (
    <>
      <Hero
        month={month}
        shift={shift}
        onShift={onShift}
        step={step}
        results={results}
        payroll={payroll}
        missing={missing.length}
        openDisputes={openDisputes}
      />
      {results.kpis.length === 0 && step === 0 && (
        <EmptyState
          variant="card"
          title={t('pay.month.none')}
          action={
            <Link className="font-semibold text-primary-text" to={hrPath('pay/plans')}>
              {t('pay.month.makePlans')}
            </Link>
          }
        >
          {t('pay.month.noneHint')}
        </EmptyState>
      )}
      {step === 0 && missing.length > 0 && <MissingValues data={results} missing={missing} />}
      <Disputes disputes={results.disputes} readOnly={step === 2} />
      <People payroll={payroll} rows={rows} onOpen={setOpen} />
      {opened && (
        <Suspense fallback={null}>
          <PersonSheet
            slip={opened}
            month={month}
            row={rows.get(opened.staff.id)}
            kpis={kpis}
            results={results}
            paid={step === 2}
            onClose={() => setOpen(null)}
          />
        </Suspense>
      )}
    </>
  );
}

/** The month on the dark card: its numbers, the three steps and the one thing to do next. */
function Hero({
  month,
  shift,
  onShift,
  step,
  results,
  payroll,
  missing,
  openDisputes,
}: {
  month: PayMonth;
  shift: number;
  onShift: (shift: number) => void;
  step: Step;
  results: KpiResults;
  payroll: Payroll;
  missing: number;
  openDisputes: number;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const scored = results.rows.filter((row) => row.score !== null);
  const average = scored.length
    ? scored.reduce((sum, row) => sum + (row.score ?? 0), 0) / scored.length
    : null;
  const totals = payroll.totals;
  const stats = [
    { key: 'net', label: t('pay.month.stat.net'), value: f.number(totals.net) },
    {
      key: 'plus',
      label: t('pay.month.stat.plus'),
      value: f.number(Math.max(totals.gross - totals.base, 0)),
    },
    {
      key: 'score',
      label: t('pay.month.stat.score'),
      value: average === null ? '—' : f.number(Math.round(average)),
    },
    { key: 'people', label: t('pay.month.stat.people'), value: f.number(payroll.slips.length) },
  ];
  const steps = [
    { key: 'check', label: t('pay.month.step.check') },
    { key: 'show', label: t('pay.month.step.show') },
    { key: 'pay', label: t('pay.month.step.pay') },
  ];
  return (
    <section
      aria-label={t('pay.month.label')}
      className="flex flex-col gap-5 rounded-card bg-hero p-5 text-on-hero lg:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton
            icon="chevronEnd"
            tone="inherit"
            aria-label={t('pay.previous')}
            onClick={() => onShift(shift - 1)}
          />
          <h2 className="m-0 min-w-36 text-center text-lead font-extrabold" aria-live="polite">
            {f.monthYear(firstDayOf(month))}
          </h2>
          <IconButton
            icon="chevronStart"
            tone="inherit"
            aria-label={t('pay.next')}
            disabled={shift >= 1}
            onClick={() => onShift(shift + 1)}
          />
        </div>
        <Chip tone={step === 2 ? 'good' : step === 1 ? 'info' : 'warn'} dot>
          {t(`pay.month.state.${STATES[step]}`)}
        </Chip>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.key} className="flex flex-col gap-1 rounded-2xl bg-hero-raised px-4 py-3">
            <dt className="text-[13px] text-on-hero-2">{stat.label}</dt>
            <dd className="m-0 text-[22px] font-extrabold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <ol aria-label={t('pay.month.steps')} className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
        {steps.map((item, index) => (
          <li
            key={item.key}
            aria-current={index === step ? 'step' : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
              index === step ? 'bg-hero-raised' : ''
            }`}
          >
            <span
              className={`flex size-8 flex-none items-center justify-center rounded-full text-[14px] font-extrabold ${
                index < step || (index === 2 && step === 2)
                  ? 'bg-good text-on-primary'
                  : index === step
                    ? 'bg-hero-current text-hero'
                    : 'border border-hero-line text-on-hero-3'
              }`}
            >
              {index < step || (index === 2 && step === 2) ? (
                <Icon name="check" size={16} />
              ) : (
                f.number(index + 1)
              )}
            </span>
            <span className={index > step ? 'text-on-hero-3' : 'font-bold'}>{item.label}</span>
          </li>
        ))}
      </ol>
      <NextAction
        month={month}
        step={step}
        results={results}
        payroll={payroll}
        missing={missing}
        openDisputes={openDisputes}
      />
    </section>
  );
}

function NextAction({
  month,
  step,
  results,
  payroll,
  missing,
  openDisputes,
}: {
  month: PayMonth;
  step: Step;
  results: KpiResults;
  payroll: Payroll;
  missing: number;
  openDisputes: number;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const show = useShowMonth();
  const reopen = useReopenMonth();
  const final = useFinalPayroll();
  const [confirming, setConfirming] = useState(false);
  const hint = 'text-[14px] leading-6 text-on-hero-2';

  if (step === 0)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hero-line pt-4">
        <p className={`m-0 max-w-2xl ${hint}`}>
          {missing > 0
            ? t('pay.month.checkBlocked', { n: f.number(missing) })
            : t('pay.month.checkHint')}
        </p>
        <Button
          disabled={missing > 0 || show.isPending || payroll.slips.length === 0}
          onClick={() =>
            show.mutate(month, {
              onSuccess: () => toast.success(t('pay.month.shown')),
              onError: () => toast.error(t('error')),
            })
          }
        >
          {t('pay.month.show')}
        </Button>
      </div>
    );

  if (step === 1)
    return (
      <div className="flex flex-col gap-3 border-t border-hero-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`m-0 max-w-2xl ${hint}`}>
            {[
              results.disputes_until &&
                t('pay.month.objectUntil', { date: f.date(results.disputes_until) }),
              t('pay.month.seen', {
                n: f.number(payroll.seen),
                of: f.number(payroll.slips.length),
              }),
              openDisputes > 0 && t('pay.month.answerFirst', { n: f.number(openDisputes) }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="onLuxe"
              disabled={reopen.isPending}
              onClick={() =>
                reopen.mutate(month, {
                  onSuccess: () => toast.success(t('pay.review.reopened')),
                  onError: () => toast.error(t('error')),
                })
              }
            >
              {t('pay.month.hide')}
            </Button>
            {!confirming && (
              <Button
                disabled={openDisputes > 0 || payroll.id === null}
                onClick={() => setConfirming(true)}
              >
                {t('pay.month.pay')}
              </Button>
            )}
          </div>
        </div>
        {confirming && payroll.id !== null && (
          <InlineConfirm
            message={t('pay.month.payConfirm', { amount: f.number(payroll.totals.net) })}
            confirmLabel={t('pay.month.payYes')}
            cancelLabel={t('me.cancel')}
            pending={final.isPending}
            onCancel={() => setConfirming(false)}
            onConfirm={() =>
              payroll.id !== null &&
              final.mutate(payroll.id, {
                onSuccess: () => toast.success(t('pay.payroll.finalDone')),
                onError: () => toast.error(t('error')),
              })
            }
          />
        )}
      </div>
    );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hero-line pt-4">
      <p className={`m-0 max-w-2xl ${hint}`}>
        {payroll.finalized_at
          ? t('pay.month.paidBy', {
              name: payroll.finalized_by ?? '',
              date: f.date(payroll.finalized_at),
            })
          : t('pay.month.paidHint')}
      </p>
      {payroll.id !== null && (
        <a href={payrollExportUrl(payroll.id)} download className={buttonClass('onLuxe')}>
          {t('pay.month.export')}
        </a>
      )}
    </div>
  );
}

function MissingValues({ data, missing }: { data: KpiResults; missing: Missing[] }) {
  const { t } = useTranslation('hr');
  const save = useSaveResults();
  const [values, setValues] = useState<Record<string, string>>({});
  const keyOf = (item: Missing) => `${String(item.row.staff.id)}:${String(item.kpi.id)}`;
  const typed = missing.filter((item) => (values[keyOf(item)] ?? '').trim() !== '');
  const bad = typed.some((item) => parseNumber(values[keyOf(item)] ?? '') === null);
  return (
    <SectionCard
      id="month-missing"
      variant="panel"
      size="lg"
      title={t('pay.month.missingTitle')}
      subtitle={t('pay.month.missingHint')}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {missing.map((item) => (
          <TextField
            key={keyOf(item)}
            label={t('pay.month.missingLabel', { name: item.row.staff.name, kpi: item.kpi.name })}
            hint={t(
              item.kpi.direction === 'lower' ? 'pay.kpis.targetAtMost' : 'pay.kpis.targetIs',
              { target: item.kpi.target, unit: item.kpi.unit },
            )}
            inputMode="decimal"
            dir="ltr"
            value={values[keyOf(item)] ?? ''}
            error={
              (values[keyOf(item)] ?? '').trim() && parseNumber(values[keyOf(item)] ?? '') === null
                ? t('pay.results.notNumber')
                : undefined
            }
            onChange={(event) => setValues({ ...values, [keyOf(item)]: event.target.value })}
          />
        ))}
      </div>
      <Button
        className="mt-4"
        disabled={typed.length === 0 || bad || save.isPending}
        onClick={() =>
          save.mutate(
            {
              year: data.year,
              month: data.month,
              results: typed.map((item) => ({
                staff: item.row.staff.id,
                kpi: item.kpi.id,
                result: parseNumber(values[keyOf(item)] ?? ''),
              })),
            },
            {
              onSuccess: () => {
                setValues({});
                toast.success(t('pay.results.saved'));
              },
              onError: () => toast.error(t('error')),
            },
          )
        }
      >
        {t('pay.save')}
      </Button>
    </SectionCard>
  );
}

/** What a slip takes off: insurance, tax and the deductions before and after tax. */
const takenOf = (slip: Slip) => slip.insurance + slip.tax + slip.deduction + slip.after_tax;

/** Everyone's score and pay, one row each; a row opens the person's slip. */
function People({
  payroll,
  rows,
  onOpen,
}: {
  payroll: Payroll;
  rows: Map<number, ResultRow>;
  onOpen: (id: number) => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  if (payroll.slips.length === 0)
    return (
      <Card className="p-5">
        <p className="m-0 text-text-2">
          {payroll.id === null ? t('pay.month.working') : t('pay.payroll.empty')}
        </p>
      </Card>
    );
  const slips = [...payroll.slips].sort((a, b) => (b.kpi_score ?? -1) - (a.kpi_score ?? -1));
  const cell = 'px-3 py-3 text-end tabular-nums';
  return (
    <SectionCard id="month-people" variant="panel" size="lg" title={t('pay.month.people')}>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[15px]">
          <caption className="sr-only">{t('pay.month.people')}</caption>
          <thead>
            <tr className="text-[13px] text-text-2">
              <th className="px-3 py-2 text-start font-semibold">{t('pay.month.col.person')}</th>
              <th className="px-3 py-2 text-end font-semibold">{t('pay.month.col.score')}</th>
              <th className="px-3 py-2 text-end font-semibold">{t('pay.month.col.base')}</th>
              <th className="px-3 py-2 text-end font-semibold">{t('pay.month.col.plus')}</th>
              <th className="px-3 py-2 text-end font-semibold">{t('pay.month.col.minus')}</th>
              <th className="px-3 py-2 text-end font-semibold">{t('pay.month.col.net')}</th>
            </tr>
          </thead>
          <tbody>
            {slips.map((slip) => {
              const row = rows.get(slip.staff.id);
              const plus = slip.gross - slip.base;
              return (
                <tr key={slip.id} className="border-t border-hair">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="flex min-h-11 items-center gap-3 text-start"
                      aria-label={t('pay.month.open', { name: slip.staff.name })}
                      onClick={() => onOpen(slip.id)}
                    >
                      <Avatar name={slip.staff.name} face={slip.staff.face} size="sm" />
                      <span className="flex flex-col">
                        <span className="font-semibold">{slip.staff.name}</span>
                        <span className="text-[13px] text-text-2">
                          {slip.position ?? ''}
                          {row && row.missing > 0 && (
                            <span className="ms-2 text-warn">
                              {t('pay.results.missing', { n: f.number(row.missing) })}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className={`${cell} font-bold`}>
                    {slip.kpi_score === null ? '—' : f.number(Math.round(slip.kpi_score))}
                  </td>
                  <td className={`${cell} text-text-2`}>{f.number(slip.base)}</td>
                  <td className={`${cell} ${plus > 0 ? 'text-good' : 'text-text-2'}`}>
                    {plus > 0 ? `+${f.number(plus)}` : f.number(plus)}
                  </td>
                  <td className={`${cell} text-text-2`}>
                    {takenOf(slip) > 0 ? `−${f.number(takenOf(slip))}` : f.number(0)}
                  </td>
                  <td className={`${cell} font-extrabold`}>{f.number(slip.net)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-hair font-bold">
              <td className="px-3 py-3">{t('pay.payroll.totals')}</td>
              <td className={cell} />
              <td className={cell}>{f.number(payroll.totals.base)}</td>
              <td className={cell}>{f.number(payroll.totals.gross - payroll.totals.base)}</td>
              <td className={cell}>
                {f.number(
                  payroll.totals.insurance +
                    payroll.totals.tax +
                    payroll.totals.deduction +
                    payroll.totals.after_tax,
                )}
              </td>
              <td className={`${cell} font-extrabold`}>{f.number(payroll.totals.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="m-0 mt-2 text-[13px] text-text-2">{t('pay.month.tomanNote')}</p>
    </SectionCard>
  );
}
