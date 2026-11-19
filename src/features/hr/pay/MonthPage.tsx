import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar, StepBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { PersonLink } from '../components/PersonLink';
import { hrPath } from '../paths';
import { MANUAL, payMonth, resultsQuery, type Kpi, type KpiResults, type ResultRow } from './api';
import { Disputes } from './components/Disputes';
import { MonthBar } from './components/MonthBar';
import { MonthReview } from './components/MonthReview';
import { useSaveResults } from './mutations';
import { parseNumber } from './numbers';

/** A manual value nobody has entered yet. */
interface Missing {
  row: ResultRow;
  kpi: Kpi;
}

/**
 * «این ماه» (canvas "KPI ساده" 3): a month's scores in four steps (measured, you check, people can
 * object, final pay), what still needs a hand before closing (manual values, open objections),
 * everyone's score with their goals, and closing the month for objections. Last month by default:
 * that is the one to check.
 */
export default function MonthPage() {
  const { t } = useTranslation('hr');
  const [shift, setShift] = useState(-1);
  const month = payMonth(shift);
  const { data } = useQuery(resultsQuery(month));
  return (
    <>
      <MonthBar month={month} shift={shift} onShift={setShift} />
      {!data ? (
        <Card className="p-5">
          <SkeletonRows rows={5} />
        </Card>
      ) : data.kpis.length === 0 ? (
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
      ) : (
        <Month key={`${String(month.year)}-${String(month.month)}`} data={data} />
      )}
    </>
  );
}

function Month({ data }: { data: KpiResults }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const kpis = new Map(data.kpis.map((kpi) => [kpi.id, kpi]));
  const rows = data.rows.filter((row) => row.kpis.length > 0);
  const missing: Missing[] = rows.flatMap((row) =>
    row.kpis.flatMap((id) => {
      const kpi = kpis.get(id);
      return kpi && kpi.metric === MANUAL && !kpi.trial && row.results[String(id)] === undefined
        ? [{ row, kpi }]
        : [];
    }),
  );
  const openDisputes = data.disputes.filter((row) => row.status === 'open').length;
  const today = new Date().toISOString().slice(0, 10);
  const objecting = data.closed && !!data.disputes_until && data.disputes_until >= today;
  const current = data.final ? 3 : !data.closed ? 1 : objecting || openDisputes > 0 ? 2 : 3;
  const scored = rows.filter((row) => row.score !== null);
  const average = scored.length
    ? scored.reduce((sum, row) => sum + (row.score ?? 0), 0) / scored.length
    : null;
  const todo = missing.length + openDisputes;

  return (
    <>
      <p className="m-0 text-[15px] text-text-2">
        {t('pay.month.summary', {
          people: f.number(rows.length),
          score: average === null ? '—' : f.number(Math.round(average)),
        })}
      </p>
      <StepBar
        label={t('pay.month.steps')}
        tone="plum"
        current={current}
        finished={data.final}
        steps={[
          {
            key: 'measured',
            label: t('pay.month.step.measured'),
            hint: t('pay.month.step.measuredHint'),
          },
          {
            key: 'review',
            label: t('pay.month.step.review'),
            hint:
              todo > 0
                ? t('pay.month.step.todo', { n: f.number(todo) })
                : t('pay.month.step.reviewHint'),
          },
          {
            key: 'objections',
            label: t('pay.month.step.objections'),
            hint: data.disputes_until
              ? t('pay.month.step.until', { date: f.date(data.disputes_until) })
              : t('pay.month.step.objectionsHint'),
          },
          { key: 'final', label: t('pay.month.step.final'), hint: t('pay.month.step.finalHint') },
        ]}
      />
      {!data.final && missing.length > 0 && <MissingValues data={data} missing={missing} />}
      <Disputes disputes={data.disputes} readOnly={data.final} />
      <People data={data} rows={rows} kpis={kpis} />
      <CloseBar data={data} blocked={missing.length} objecting={objecting} />
    </>
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

function People({
  data,
  rows,
  kpis,
}: {
  data: KpiResults;
  rows: ResultRow[];
  kpis: Map<number, Kpi>;
}) {
  const { t } = useTranslation('hr');
  const [open, setOpen] = useState<number | null>(null);
  const sorted = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <SectionCard id="month-people" variant="panel" size="lg" title={t('pay.month.people')}>
      <ul aria-label={t('pay.month.people')} className="m-0 flex list-none flex-col p-0">
        {sorted.map((row) => (
          <PersonRow
            key={row.staff.id}
            row={row}
            data={data}
            kpis={row.kpis.flatMap((id) => kpis.get(id) ?? [])}
            open={open === row.staff.id}
            onToggle={() => setOpen(open === row.staff.id ? null : row.staff.id)}
          />
        ))}
      </ul>
    </SectionCard>
  );
}

function PersonRow({
  row,
  data,
  kpis,
  open,
  onToggle,
}: {
  row: ResultRow;
  data: KpiResults;
  kpis: Kpi[];
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const objection = data.disputes.some(
    (dispute) => dispute.staff.id === row.staff.id && dispute.status === 'open',
  );
  return (
    <li className="flex flex-col gap-3 border-t border-hair py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="min-w-0 flex-[1_1_200px]">
          <PersonLink id={row.staff.id} name={row.staff.name} face={row.staff.face} />
        </span>
        <span className="flex flex-[1_1_220px] items-center gap-3">
          <ProgressBar
            className="flex-1"
            value={row.score === null ? 0 : Math.min(row.score, 100)}
          />
          <b className="min-w-8 text-[17px]">
            {row.score === null ? '—' : f.number(Math.round(row.score))}
          </b>
        </span>
        <span className="flex items-center gap-2">
          {objection ? (
            <Chip tone="primary" small>
              {t('pay.month.objection')}
            </Chip>
          ) : row.missing > 0 ? (
            <Chip tone="warn" small>
              {t('pay.results.missing', { n: f.number(row.missing) })}
            </Chip>
          ) : (
            <Chip tone="good" small>
              {t('pay.month.ready')}
            </Chip>
          )}
          <Button variant="outline" aria-expanded={open} onClick={onToggle}>
            {open ? t('close') : t('pay.month.details')}
          </Button>
        </span>
      </div>
      {open && (
        <ul className="m-0 flex list-none flex-col rounded-2xl bg-canvas px-4 py-1">
          {kpis.map((kpi) => (
            <GoalValue key={kpi.id} kpi={kpi} row={row} data={data} />
          ))}
        </ul>
      )}
    </li>
  );
}

function GoalValue({ kpi, row, data }: { kpi: Kpi; row: ResultRow; data: KpiResults }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const save = useSaveResults();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const detail = row.details[String(kpi.id)];
  const manual = kpi.metric === MANUAL;
  const parsed = parseNumber(value);
  const shown = detail ? `${f.number(detail.value)} ${kpi.unit}`.trim() : t('me.noValue');
  return (
    <li className="flex flex-col gap-2 border-t border-hair py-2.5 text-[14px] first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex-[1_1_220px] font-semibold">
          {kpi.name}
          {kpi.trial && (
            <span className="ms-2">
              <Chip tone="warn" small>
                {t('pay.trial')}
              </Chip>
            </span>
          )}
        </span>
        <span className="flex-[0_1_220px] text-text-2">
          <span className="text-text">{shown}</span>
          {' / '}
          {t(kpi.direction === 'lower' ? 'pay.kpis.targetAtMost' : 'pay.kpis.targetIs', {
            target: f.number(kpi.target),
            unit: kpi.unit,
          })}
        </span>
        <b className="min-w-12">
          {detail?.part == null ? '—' : t('me.percent', { n: f.number(detail.part) })}
        </b>
        {!data.final && !editing && (
          <button
            type="button"
            className="min-h-11 font-semibold text-primary-text"
            onClick={() => {
              setValue(detail ? String(detail.value) : '');
              setEditing(true);
            }}
          >
            {t('pay.month.fix')}
          </button>
        )}
      </div>
      {detail?.source === 'override' && detail.note && (
        <p className="m-0 text-[13px] text-text-2">{t('pay.results.why', { note: detail.note })}</p>
      )}
      {editing && (
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label={t('pay.month.newValue')}
            inputMode="decimal"
            dir="ltr"
            value={value}
            error={value.trim() && parsed === null ? t('pay.results.notNumber') : undefined}
            onChange={(event) => setValue(event.target.value)}
          />
          {!manual && (
            <TextField
              label={t('pay.results.note')}
              placeholder={t('pay.results.notePlaceholder')}
              value={note}
              maxLength={256}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
          <Button
            disabled={parsed === null || (!manual && !note.trim()) || save.isPending}
            onClick={() =>
              save.mutate(
                {
                  year: data.year,
                  month: data.month,
                  results: [
                    { staff: row.staff.id, kpi: kpi.id, result: parsed, note: note.trim() },
                  ],
                },
                {
                  onSuccess: () => {
                    setEditing(false);
                    setNote('');
                    toast.success(t('pay.results.saved'));
                  },
                  onError: () => toast.error(t('error')),
                },
              )
            }
          >
            {t('pay.save')}
          </Button>
          <Button variant="outline" onClick={() => setEditing(false)}>
            {t('me.cancel')}
          </Button>
        </div>
      )}
    </li>
  );
}

function CloseBar({
  data,
  blocked,
  objecting,
}: {
  data: KpiResults;
  blocked: number;
  objecting: boolean;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const message = data.final
    ? t('pay.month.closeFinal')
    : data.closed
      ? objecting && data.disputes_until
        ? t('pay.month.closeObjecting', { date: f.date(data.disputes_until) })
        : t('pay.month.closeDone')
      : blocked > 0
        ? t('pay.month.closeBlocked', { n: f.number(blocked) })
        : t('pay.month.closeReady');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-hero px-5 py-4 text-on-hero">
      <span className="flex max-w-2xl flex-col gap-1">
        <span className="font-bold">{t('pay.month.closeTitle')}</span>
        <span className="text-[14px] text-on-hero-2">{message}</span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <MonthReview month={data} data={data} disabled={blocked > 0} />
        {data.closed && (
          <Link
            to={hrPath('pay/payroll')}
            className="inline-flex min-h-11 items-center font-semibold text-on-hero underline"
          >
            {t('pay.section.payroll')}
          </Link>
        )}
      </span>
    </div>
  );
}
