import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SaveBar } from '@/components/ui/SaveBar';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import { toast } from '@/lib/toast';
import { PersonLink } from '../components/PersonLink';
import { hrPath } from '../paths';
import { payMonth, resultsQuery, useSaveResults, type Kpi, type ResultRow } from './api';
import { MonthBar } from './components/MonthBar';

/** `staff:kpi` → what is typed. */
type Drafts = Record<string, string>;
const keyOf = (staff: number, kpi: number) => `${String(staff)}:${String(kpi)}`;

function parseResult(value: string): number | null | undefined {
  const text = toLatinDigits(value).trim().replace(/[٫,]/g, '.');
  if (text === '') return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

/**
 * The month's KPI results (canvas "ثبت نتیجه‌ها"): everyone who worked that month with their
 * position's KPIs; what is typed is saved together, and the score follows. A final month is read
 * only.
 */
export default function ResultsPage() {
  const { t } = useTranslation('hr');
  const [shift, setShift] = useState(0);
  const month = payMonth(shift);
  const { data } = useQuery(resultsQuery(month));
  const save = useSaveResults();
  const [drafts, setDrafts] = useState<Drafts>({});
  const changed = Object.entries(drafts);
  const invalid = changed.some(([, value]) => parseResult(value) === undefined);

  const move = (next: number) => {
    setDrafts({});
    setShift(next);
  };
  const submit = () =>
    save.mutate(
      {
        ...month,
        results: changed.map(([key, value]) => {
          const [staff = 0, kpi = 0] = key.split(':').map(Number);
          return { staff, kpi, result: parseResult(value) ?? null };
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

  const byPosition = new Map<number, Kpi[]>();
  for (const kpi of data?.kpis ?? []) {
    byPosition.set(kpi.position, [...(byPosition.get(kpi.position) ?? []), kpi]);
  }
  const rows = (data?.rows ?? []).filter(
    (row) => row.position !== null && byPosition.has(row.position),
  );

  return (
    <>
      <MonthBar month={month} shift={shift} onShift={move}>
        {data?.final && (
          <Chip tone="good" dot>
            {t('pay.results.final')}
          </Chip>
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
              kpis={byPosition.get(row.position ?? -1) ?? []}
              drafts={drafts}
              readOnly={data.final}
              onChange={(kpi, value) => setDrafts({ ...drafts, [keyOf(row.staff.id, kpi)]: value })}
            />
          ))}
        </ul>
      )}
      {data && !data.final && rows.length > 0 && (
        <SaveBar
          dirty={changed.length > 0}
          message={
            invalid
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
          <Button disabled={changed.length === 0 || invalid || save.isPending} onClick={submit}>
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
  onChange: (kpi: number, value: string) => void;
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
          {kpis.map((kpi) => {
            const saved = row.results[String(kpi.id)];
            const draft = drafts[keyOf(row.staff.id, kpi.id)];
            const value = draft ?? (saved === undefined ? '' : String(saved));
            return (
              <TextField
                key={kpi.id}
                label={kpi.name}
                hint={t('pay.results.target', {
                  target: f.number(kpi.target),
                  unit: kpi.unit,
                  weight: f.number(kpi.weight),
                })}
                inputMode="decimal"
                dir="ltr"
                value={value}
                readOnly={readOnly}
                error={
                  draft !== undefined && parseResult(draft) === undefined
                    ? t('pay.results.notNumber')
                    : undefined
                }
                onChange={(event) => onChange(kpi.id, event.target.value)}
              />
            );
          })}
        </div>
      </Card>
    </li>
  );
}
