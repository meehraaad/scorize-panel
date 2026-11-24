import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressBar } from '@/components/ui/Progress';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { parseAmount } from '../../format';
import { personPath, planPath } from '../../paths';
import {
  firstDayOf,
  HAND_KINDS,
  MANUAL,
  type HandKind,
  type Kpi,
  type KpiResults,
  type PayMonth,
  type ResultRow,
  type Slip,
  type SlipLine,
} from '../api';
import { useAddSlipLine, useCorrectSlip, useRemoveSlipLine, useSaveResults } from '../mutations';
import { parseNumber } from '../numbers';

const AFTER_TAX = new Set(['advance', 'deduction']);

/**
 * One person's month (canvas "فیش هر نفر"): their score with the reason for each goal, then the
 * slip. While the month isn't paid, a goal's value can be fixed and lines added by hand
 * (overtime, a bonus, an advance, another deduction); a paid month is corrected on next month's
 * slip.
 */
export default function PersonSheet({
  slip,
  month,
  row,
  kpis,
  results,
  paid,
  onClose,
}: {
  slip: Slip;
  month: PayMonth;
  row: ResultRow | undefined;
  kpis: Map<number, Kpi>;
  results: KpiResults;
  paid: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const goals = row ? row.kpis.flatMap((id) => kpis.get(id) ?? []) : [];
  return (
    <Dialog
      open
      onClose={onClose}
      title={slip.staff.name}
      subtitle={[f.monthYear(firstDayOf(month)), slip.position, slip.personnel_code]
        .filter(Boolean)
        .join(' · ')}
      closeLabel={t('close')}
    >
      <div className="flex flex-col gap-6">
        {row && goals.length > 0 && (
          <section aria-label={t('pay.sheet.score')} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h3 className="m-0 text-[15px] font-bold">{t('pay.sheet.score')}</h3>
              <ProgressBar
                className="flex-1"
                value={row.score === null ? 0 : Math.min(row.score, 100)}
              />
              <b className="text-lead">
                {row.score === null ? '—' : f.number(Math.round(row.score))}
              </b>
            </div>
            <ul className="m-0 flex list-none flex-col rounded-2xl bg-canvas px-4 py-1">
              {goals.map((kpi) => (
                <GoalValue
                  key={kpi.id}
                  kpi={kpi}
                  row={row}
                  data={results}
                  editable={!paid && !results.final}
                />
              ))}
            </ul>
          </section>
        )}
        <SlipView slip={slip} editable={!paid} />
        {paid ? <Correction slip={slip} /> : <AddLine slip={slip} />}
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-hair pt-4 text-[14px]">
          <Link
            className="min-h-11 content-center font-semibold text-primary-text"
            to={personPath(slip.staff.id)}
          >
            {t('pay.sheet.file')}
          </Link>
          <Link
            className="min-h-11 content-center font-semibold text-primary-text"
            to={planPath(`person:${String(slip.staff.id)}`)}
          >
            {t('pay.sheet.exception')}
          </Link>
        </div>
      </div>
    </Dialog>
  );
}

function GoalValue({
  kpi,
  row,
  data,
  editable,
}: {
  kpi: Kpi;
  row: ResultRow;
  data: KpiResults;
  editable: boolean;
}) {
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex-[1_1_160px] font-semibold">
          {kpi.name}
          {kpi.trial && (
            <span className="ms-2">
              <Chip tone="warn" small>
                {t('pay.trial')}
              </Chip>
            </span>
          )}
        </span>
        <span className="text-text-2">
          <span className="text-text">{shown}</span>
          {' / '}
          {t(kpi.direction === 'lower' ? 'pay.kpis.targetAtMost' : 'pay.kpis.targetIs', {
            target: f.number(kpi.target),
            unit: kpi.unit,
          })}
        </span>
        <b className="min-w-10 text-end">
          {detail?.part == null ? '—' : t('me.percent', { n: f.number(detail.part) })}
        </b>
        {editable && !editing && (
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
      {detail && detail.evidence.length > 0 && (
        <p className="m-0 text-[13px] text-text-2">{detail.evidence.join(' · ')}</p>
      )}
      {detail?.source === 'override' && detail.note && (
        <p className="m-0 text-[13px] text-text-2">{t('pay.results.why', { note: detail.note })}</p>
      )}
      {editing && (
        <div className="flex flex-col gap-3">
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
          <div className="flex flex-wrap gap-2">
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
        </div>
      )}
    </li>
  );
}

/** The slip: what is earned, what is taken off, what is paid. Hand lines can be removed. */
function SlipView({ slip, editable }: { slip: Slip; editable: boolean }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const toman = (amount: number) => t('toman', { amount: f.number(amount) });
  const before = slip.lines.filter((line) => !AFTER_TAX.has(line.kind ?? 'rule'));
  const after = slip.lines.filter((line) => AFTER_TAX.has(line.kind ?? 'rule'));
  return (
    <section aria-label={t('pay.sheet.slip')} className="flex flex-col gap-4">
      <Lines title={t('pay.slip.earnings')}>
        <Line label={t('pay.slip.base')} value={toman(slip.base)} />
        {slip.kpi_bonus !== 0 && (
          <Line
            label={
              slip.kpi_score === null
                ? t('pay.slip.kpiBonus')
                : t('pay.slip.kpiBonusScore', { score: f.number(slip.kpi_score) })
            }
            value={toman(slip.kpi_bonus)}
          />
        )}
        {slip.addition !== 0 && (
          <Line label={slip.addition_note || t('pay.slip.addition')} value={toman(slip.addition)} />
        )}
        {before.map((line, index) => (
          <SlipLineRow key={line.id ?? `r${String(index)}`} line={line} editable={editable} />
        ))}
        <Line strong label={t('pay.slip.gross')} value={toman(slip.gross)} />
      </Lines>
      <Lines title={t('pay.slip.taken')}>
        <Line
          label={slip.insured ? t('pay.slip.insurance') : t('pay.slip.notInsured')}
          value={toman(slip.insurance)}
        />
        <Line label={t('pay.slip.tax')} value={toman(slip.tax)} />
        {slip.deduction !== 0 && (
          <Line
            label={slip.deduction_note || t('pay.slip.deduction')}
            value={toman(slip.deduction)}
          />
        )}
        {after.map((line, index) => (
          <SlipLineRow key={line.id ?? `a${String(index)}`} line={line} editable={editable} />
        ))}
      </Lines>
      <div className="flex items-center justify-between rounded-2xl bg-tint px-4 py-3 text-primary-text">
        <span className="font-bold">{t('pay.slip.net')}</span>
        <span className="text-lead font-bold">{toman(slip.net)}</span>
      </div>
    </section>
  );
}

function SlipLineRow({ line, editable }: { line: SlipLine; editable: boolean }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const remove = useRemoveSlipLine();
  const hand = line.id !== undefined && line.kind !== undefined && line.kind !== 'rule';
  const label = line.detail ? `${line.label} (${line.detail})` : line.label;
  const amount = AFTER_TAX.has(line.kind ?? 'rule') ? -line.amount : line.amount;
  return (
    <Line
      label={label}
      value={t('toman', { amount: f.number(amount) })}
      trial={line.trial}
      end={
        editable && hand && line.id !== undefined ? (
          <IconButton
            icon="close"
            tone="muted"
            aria-label={t('pay.sheet.removeLine', { label: line.label })}
            disabled={remove.isPending}
            onClick={() =>
              line.id !== undefined &&
              remove.mutate(line.id, {
                onSuccess: () => toast.success(t('pay.sheet.removed')),
                onError: () => toast.error(t('error')),
              })
            }
          />
        ) : undefined
      }
    />
  );
}

function Lines({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className="m-0 mb-1 text-sm font-bold text-text-2">{title}</h3>
      <dl className="m-0 flex flex-col">{children}</dl>
    </section>
  );
}

function Line({
  label,
  value,
  strong,
  trial,
  end,
}: {
  label: string;
  value: string;
  strong?: boolean;
  trial?: boolean;
  end?: ReactNode;
}) {
  const { t } = useTranslation('hr');
  return (
    <div
      className={`flex min-h-11 items-center justify-between gap-3 border-t border-hair py-1.5 first:border-t-0 ${
        strong ? 'font-bold' : ''
      } ${trial ? 'text-text-2' : ''}`}
    >
      <dt className="flex min-w-0 items-center gap-2 text-[15px]">
        <span className="truncate">{label}</span>
        {trial && (
          <Chip tone="warn" small>
            {t('pay.trial')}
          </Chip>
        )}
      </dt>
      <dd className="m-0 flex items-center gap-1 text-[15px]">
        <span dir="ltr">{value}</span>
        {end}
      </dd>
    </div>
  );
}

/** Adds overtime, a bonus, an advance or another deduction to a slip not paid yet. */
function AddLine({ slip }: { slip: Slip }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const add = useAddSlipLine(slip.id);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<HandKind>('overtime');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const parsed = parseAmount(amount);
  if (!open)
    return (
      <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
        {t('pay.sheet.addLine')}
      </Button>
    );
  return (
    <fieldset className="m-0 flex flex-col gap-3 rounded-2xl border-0 bg-canvas p-4">
      <legend className="sr-only">{t('pay.sheet.addLine')}</legend>
      <ChoiceGroup
        legend={t('pay.sheet.kind')}
        look="segmented"
        options={HAND_KINDS.map((value) => ({ value, label: t(`pay.sheet.kinds.${value}`) }))}
        value={kind}
        onChange={setKind}
      />
      <TextField
        label={t('pay.sheet.amount')}
        hint={
          parsed
            ? t('toman', { amount: f.number(parsed) })
            : t(AFTER_TAX.has(kind) ? 'pay.sheet.takenHint' : 'pay.sheet.addedHint')
        }
        inputMode="numeric"
        dir="ltr"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <TextField
        label={t('pay.sheet.note')}
        hint={t('pay.sheet.noteHint')}
        value={note}
        maxLength={256}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!parsed || add.isPending}
          onClick={() =>
            parsed &&
            add.mutate(
              { kind, amount: parsed, note: note.trim() },
              {
                onSuccess: () => {
                  setAmount('');
                  setNote('');
                  setOpen(false);
                  toast.success(t('pay.sheet.added'));
                },
                onError: () => toast.error(t('error')),
              },
            )
          }
        >
          {t('pay.sheet.add')}
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>
          {t('me.cancel')}
        </Button>
      </div>
    </fieldset>
  );
}

/** A paid month stays as it was: a mistake is made good on next month's slip. */
function Correction({ slip }: { slip: Slip }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const correct = useCorrectSlip(slip.id);
  const [open, setOpen] = useState(false);
  const [sign, setSign] = useState<'plus' | 'minus'>('plus');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const parsed = parseAmount(amount);
  if (!open)
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[14px] leading-6 text-text-2">{t('pay.sheet.locked')}</p>
        <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
          {t('pay.sheet.correct')}
        </Button>
      </div>
    );
  return (
    <fieldset className="m-0 flex flex-col gap-3 rounded-2xl border-0 bg-canvas p-4">
      <legend className="sr-only">{t('pay.sheet.correct')}</legend>
      <ChoiceGroup
        legend={t('pay.sheet.direction')}
        look="segmented"
        options={[
          { value: 'plus', label: t('pay.sheet.plus') },
          { value: 'minus', label: t('pay.sheet.minus') },
        ]}
        value={sign}
        onChange={setSign}
      />
      <TextField
        label={t('pay.sheet.amount')}
        hint={parsed ? t('toman', { amount: f.number(parsed) }) : t('pay.sheet.correctHint')}
        inputMode="numeric"
        dir="ltr"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <TextField
        label={t('pay.sheet.note')}
        hint={t('pay.sheet.noteHint')}
        value={note}
        maxLength={256}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!parsed || !note.trim() || correct.isPending}
          onClick={() =>
            parsed &&
            correct.mutate(
              { amount: sign === 'plus' ? parsed : -parsed, note: note.trim() },
              {
                onSuccess: () => {
                  setOpen(false);
                  toast.success(t('pay.sheet.corrected'));
                },
                onError: () => toast.error(t('pay.sheet.correctFailed')),
              },
            )
          }
        >
          {t('pay.sheet.correctSave')}
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>
          {t('me.cancel')}
        </Button>
      </div>
    </fieldset>
  );
}
