import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { parseAmount } from '../../format';
import { firstDayOf, payrollQuery, useEditSlip, type PayMonth, type Slip } from '../api';

/**
 * One payslip (canvas "فیش حقوقی"): earnings, then what is taken off, then what is paid. While
 * the month is a draft, additions (commission, overtime) and deductions (advances) are entered
 * here; the API works the slip out again.
 */
export default function PayslipDialog({
  id,
  month,
  onClose,
}: {
  id: number;
  month: PayMonth;
  onClose: () => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const { data } = useQuery(payrollQuery(month));
  const slip = data?.slips.find((row) => row.id === id);
  if (!data || !slip) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('pay.slip.title', { name: slip.staff.name })}
      subtitle={[f.monthYear(firstDayOf(month)), slip.position, slip.personnel_code]
        .filter(Boolean)
        .join(' · ')}
      closeLabel={t('close')}
    >
      <SlipBody slip={slip} editable={data.status === 'draft'} />
    </Dialog>
  );
}

function SlipBody({ slip, editable }: { slip: Slip; editable: boolean }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const toman = (amount: number) => t('toman', { amount: f.number(amount) });
  return (
    <div className="flex flex-col gap-4">
      <Lines title={t('pay.slip.earnings')}>
        <Line label={t('pay.slip.base')} value={toman(slip.base)} />
        <Line
          label={
            slip.kpi_score === null
              ? t('pay.slip.kpiBonus')
              : t('pay.slip.kpiBonusScore', { score: f.number(slip.kpi_score) })
          }
          value={toman(slip.kpi_bonus)}
        />
        <Line label={slip.addition_note || t('pay.slip.addition')} value={toman(slip.addition)} />
        {slip.lines.map((line, index) => (
          <Line
            key={index}
            label={line.detail ? `${line.label} (${line.detail})` : line.label}
            value={toman(line.amount)}
            trial={line.trial}
          />
        ))}
        <Line strong label={t('pay.slip.gross')} value={toman(slip.gross)} />
      </Lines>
      <Lines title={t('pay.slip.taken')}>
        <Line
          label={slip.insured ? t('pay.slip.insurance') : t('pay.slip.notInsured')}
          value={toman(slip.insurance)}
        />
        <Line label={t('pay.slip.tax')} value={toman(slip.tax)} />
        <Line
          label={slip.deduction_note || t('pay.slip.deduction')}
          value={toman(slip.deduction)}
        />
      </Lines>
      <div className="flex items-center justify-between rounded-2xl bg-tint px-4 py-3 text-primary-text">
        <span className="font-bold">{t('pay.slip.net')}</span>
        <span className="text-lg font-bold">{toman(slip.net)}</span>
      </div>
      {editable && <SlipEdit slip={slip} />}
    </div>
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

/** A trial line (a reward or penalty not paid yet) shows dimmed with its chip. */
function Line({
  label,
  value,
  strong,
  trial,
}: {
  label: string;
  value: string;
  strong?: boolean;
  trial?: boolean;
}) {
  const { t } = useTranslation('hr');
  return (
    <div
      className={`flex items-center justify-between gap-3 border-t border-hair py-2 first:border-t-0 ${
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
      <dd className="m-0 text-[15px]" dir="ltr">
        {value}
      </dd>
    </div>
  );
}

function SlipEdit({ slip }: { slip: Slip }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const save = useEditSlip(slip.id);
  const [addition, setAddition] = useState(slip.addition ? String(slip.addition) : '');
  const [additionNote, setAdditionNote] = useState(slip.addition_note);
  const [deduction, setDeduction] = useState(slip.deduction ? String(slip.deduction) : '');
  const [deductionNote, setDeductionNote] = useState(slip.deduction_note);
  const added = parseAmount(addition) ?? 0;
  const taken = parseAmount(deduction) ?? 0;
  const dirty =
    added !== slip.addition ||
    taken !== slip.deduction ||
    additionNote !== slip.addition_note ||
    deductionNote !== slip.deduction_note;
  const hint = (value: number) => (value ? t('toman', { amount: f.number(value) }) : undefined);
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 border-t border-hair p-0 pt-4">
      <legend className="sr-only">{t('pay.slip.edit')}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t('pay.slip.addition')}
          hint={hint(added)}
          inputMode="numeric"
          dir="ltr"
          value={addition}
          onChange={(event) => setAddition(event.target.value)}
        />
        <TextField
          label={t('pay.slip.additionNote')}
          value={additionNote}
          maxLength={256}
          onChange={(event) => setAdditionNote(event.target.value)}
        />
        <TextField
          label={t('pay.slip.deduction')}
          hint={hint(taken)}
          inputMode="numeric"
          dir="ltr"
          value={deduction}
          onChange={(event) => setDeduction(event.target.value)}
        />
        <TextField
          label={t('pay.slip.deductionNote')}
          value={deductionNote}
          maxLength={256}
          onChange={(event) => setDeductionNote(event.target.value)}
        />
      </div>
      <div>
        <Button
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate(
              {
                addition: added,
                addition_note: additionNote.trim(),
                deduction: taken,
                deduction_note: deductionNote.trim(),
              },
              {
                onSuccess: () => toast.success(t('pay.slip.saved')),
                onError: () => toast.error(t('error')),
              },
            )
          }
        >
          {t('pay.slip.save')}
        </Button>
      </div>
    </fieldset>
  );
}
