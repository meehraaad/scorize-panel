import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { SaveBar } from '@/components/ui/SaveBar';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import { toast } from '@/lib/toast';
import { PersonLink } from '../components/PersonLink';
import { hrPath } from '../paths';
import {
  MANUAL,
  payMonth,
  resultsQuery,
  useRefreshResults,
  useSaveResults,
  type Kpi,
  type ResultInput,
  type ResultRow,
} from './api';
import { MonthBar } from './components/MonthBar';

/** `staff:kpi` → what is typed (the value, and why a measured one changes). */
type Drafts = Record<string, { value?: string; note?: string; back?: boolean }>;
const keyOf = (staff: number, kpi: number) => `${String(staff)}:${String(kpi)}`;

function parseResult(value: string): number | null | undefined {
  const text = toLatinDigits(value).trim().replace(/[٫,]/g, '.');
  if (text === '') return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

/**
 * The month's KPI values (canvas "ثبت نتیجه‌ها"): everyone who worked that month with the KPIs
 * that apply to them. Manual KPIs are typed in; measured ones show what the system found (and
 * why), and changing one by hand needs a reason. What is typed is saved together and the score
 * follows. A final month is read only.
 */
export default function ResultsPage() {
  const { t } = useTranslation('hr');
  const [shift, setShift] = useState(0);
  const month = payMonth(shift);
  const { data } = useQuery(resultsQuery(month));
  const save = useSaveResults();
  const refresh = useRefreshResults();
  const [drafts, setDrafts] = useState<Drafts>({});
  const kpis = new Map((data?.kpis ?? []).map((kpi) => [kpi.id, kpi]));
  const changed = Object.entries(drafts).filter(
    ([, draft]) => draft.back || draft.value !== undefined,
  );
  const problem = changed.find(([key, draft]) => {
    if (draft.back) return false;
    const [, kpi = 0] = key.split(':').map(Number);
    if (draft.value !== undefined && parseResult(draft.value) === undefined) return true;
    return kpis.get(kpi)?.metric !== MANUAL && !draft.note?.trim();
  });

  const move = (next: number) => {
    setDrafts({});
    setShift(next);
  };
  const submit = () =>
    save.mutate(
      {
        ...month,
        results: changed.map(([key, draft]): ResultInput => {
          const [staff = 0, kpi = 0] = key.split(':').map(Number);
          return {
            staff,
            kpi,
            result: draft.back ? null : (parseResult(draft.value ?? '') ?? null),
            note: draft.note?.trim() ?? '',
          };
        }),
      },
      {
        onSuccess: () => {
          setDrafts({});
          toast.success(t('pay.results.saved'));
        },
        onError: () => toast.error(t('error')),
      },
    );

  const rows = (data?.rows ?? []).filter((row) => row.kpis.length > 0);
  const measured = (data?.kpis ?? []).some((kpi) => kpi.metric !== MANUAL);

  return (
    <>
      <MonthBar month={month} shift={shift} onShift={move}>
        {data?.final && (
          <Chip tone="good" dot>
            {t('pay.results.final')}
          </Chip>
        )}
        {data && !data.final && measured && (
          <Button
            variant="outline"
            disabled={refresh.isPending}
            onClick={() =>
              refresh.mutate(month, {
                onSuccess: () => toast.success(t('pay.results.refreshed')),
                onError: () => toast.error(t('error')),
              })
            }
          >
            <Icon name="retry" size={16} />
            {t('pay.results.refresh')}
          </Button>
        )}
      </MonthBar>
      {!data ? (
        <Card className="p-5">
          <SkeletonRows rows={5} />
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          title={t('pay.results.none')}
          action={
            <Link className="font-semibold text-primary-text" to={hrPath('pay/kpis')}>
              {t('pay.results.define')}
            </Link>
          }
        >
          {t('pay.results.noneHint')}
        </EmptyState>
      ) : (
        <ul aria-label={t('pay.results.label')} className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((row) => (
            <PersonResults
              key={row.staff.id}
              row={row}
              kpis={row.kpis.flatMap((id) => kpis.get(id) ?? [])}
              drafts={drafts}
              readOnly={data.final}
              onChange={(kpi, change) => {
                const key = keyOf(row.staff.id, kpi);
                setDrafts({ ...drafts, [key]: { ...drafts[key], ...change } });
              }}
            />
          ))}
        </ul>
      )}
      {data && !data.final && rows.length > 0 && (
        <SaveBar
          dirty={changed.length > 0}
          message={
            problem
              ? t('pay.results.invalid')
              : changed.length > 0
                ? t('pay.results.unsaved')
                : t('pay.results.hint')
          }
        >
          {changed.length > 0 && (
            <Button variant="outline" onClick={() => setDrafts({})}>
              {t('pay.undo')}
            </Button>
          )}
          <Button
            disabled={changed.length === 0 || problem !== undefined || save.isPending}
            onClick={submit}
          >
            {t('pay.save')}
          </Button>
        </SaveBar>
      )}
    </>
  );
}

function PersonResults({
  row,
  kpis,
  drafts,
  readOnly,
  onChange,
}: {
  row: ResultRow;
  kpis: Kpi[];
  drafts: Drafts;
  readOnly: boolean;
  onChange: (kpi: number, change: Drafts[string]) => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  return (
    <li>
      <Card className="flex flex-col gap-3 p-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PersonLink id={row.staff.id} name={row.staff.name} face={row.staff.face} />
          <span className="flex flex-wrap items-center gap-2">
            {row.missing > 0 && (
              <Chip tone="warn" small>
                {t('pay.results.missing', { n: f.number(row.missing) })}
              </Chip>
            )}
            <Chip tone={row.score === null ? 'neutral' : 'primary'}>
              {row.score === null
                ? t('pay.slip.noScore')
                : t('pay.slip.score', { score: f.number(row.score) })}
            </Chip>
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <KpiValue
              key={kpi.id}
              kpi={kpi}
              row={row}
              draft={drafts[keyOf(row.staff.id, kpi.id)]}
              readOnly={readOnly}
              onChange={(change) => onChange(kpi.id, change)}
            />
          ))}
        </div>
      </Card>
    </li>
  );
}

function KpiValue({
  kpi,
  row,
  draft,
  readOnly,
  onChange,
}: {
  kpi: Kpi;
  row: ResultRow;
  draft: Drafts[string] | undefined;
  readOnly: boolean;
  onChange: (change: Drafts[string]) => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const detail = row.details[String(kpi.id)];
  const manual = kpi.metric === MANUAL;
  const saved = detail ? String(detail.value) : '';
  const value = draft?.back ? String(detail?.measured ?? '') : (draft?.value ?? saved);
  const editing = draft?.value !== undefined && !draft.back;
  const target = t(kpi.direction === 'lower' ? 'pay.results.targetAtMost' : 'pay.results.target', {
    target: f.number(kpi.target),
    unit: kpi.unit,
    weight: f.number(kpi.weight),
  });
  const hint = [
    target,
    !manual &&
      (detail?.measured == null
        ? t('pay.results.notMeasured')
        : t('pay.results.measured', { value: f.number(detail.measured) })),
    detail?.part != null && t('pay.results.part', { part: f.number(detail.part) }),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={kpi.name}
        hint={hint}
        inputMode="decimal"
        dir="ltr"
        value={value}
        readOnly={readOnly}
        error={
          draft?.value !== undefined && parseResult(draft.value) === undefined
            ? t('pay.results.notNumber')
            : undefined
        }
        onChange={(event) => onChange({ value: event.target.value, back: false })}
      />
      <span className="flex flex-wrap items-center gap-1.5">
        {!manual && (
          <Chip tone={detail?.source === 'override' ? 'warn' : 'neutral'} small>
            {detail?.source === 'override' ? t('pay.results.changed') : t('pay.results.auto')}
          </Chip>
        )}
        {kpi.trial && (
          <Chip tone="warn" small>
            {t('pay.trial')}
          </Chip>
        )}
        {detail && detail.evidence.length > 0 && (
          <span className="text-[13px] text-text-2" dir="auto">
            {f.list(detail.evidence.slice(0, 6))}
          </span>
        )}
      </span>
      {detail?.source === 'override' && !editing && (
        <p className="m-0 text-[13px] text-text-2">
          {t('pay.results.why', { note: detail.note })}
          {!readOnly && !draft?.back && (
            <button
              type="button"
              className="ms-2 min-h-11 font-semibold text-primary-text"
              onClick={() => onChange({ back: true })}
            >
              {t('pay.results.backToMeasured')}
            </button>
          )}
        </p>
      )}
      {!manual && editing && (
        <TextField
          label={t('pay.results.note')}
          placeholder={t('pay.results.notePlaceholder')}
          value={draft.note ?? ''}
          maxLength={256}
          error={draft.note?.trim() ? undefined : t('pay.results.noteNeeded')}
          onChange={(event) => onChange({ note: event.target.value })}
        />
      )}
    </div>
  );
}
