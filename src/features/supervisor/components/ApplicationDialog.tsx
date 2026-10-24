import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { TextField } from '@/components/ui/TextField';
import type { Degree } from '@/lib/applicant/approval';
import {
  APPLICATION_RESULTS,
  FEE_PAYMENTS,
  type ApplicationResult,
  type FeePayment,
} from '@/lib/applications';
import { toLatinNumber } from '@/lib/text';
import { toast } from '@/lib/toast';
import {
  useDeleteApplication,
  useSaveApplication,
  type ApplicationInput,
  type CaseApplication,
} from '../api';

/** Degrees an application is for (apply.models.Degree). */
const DEGREES: readonly Degree[] = [1, 2, 3, 4];
/** Currencies application fees are paid in; '' = no fee. */
const CURRENCIES = ['', 'EUR', 'USD', 'CAD', 'GBP', 'AUD', 'SEK', 'CHF'] as const;
type Currency = (typeof CURRENCIES)[number];
const isCurrency = (value: string): value is Currency => CURRENCIES.includes(value as Currency);

/** The date part of an ISO date, for the date field. */
const dayOf = (value: string | null) => (value ? value.slice(0, 10) : '');

/**
 * The side editor of an application (canvas V1 "ویرایش اپلای"): add one, or change its deadline,
 * fee, result and the note the applicant sees; delete with a second step.
 */
export function ApplicationDialog({
  caseId,
  application,
  open,
  onClose,
}: {
  caseId: number;
  /** null: a new application. */
  application: CaseApplication | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const { t: tc } = useTranslation();
  const save = useSaveApplication(caseId);
  const remove = useDeleteApplication(caseId);
  const [university, setUniversity] = useState(application?.university ?? '');
  const [program, setProgram] = useState(application?.program ?? '');
  const [degree, setDegree] = useState<Degree>(application?.degree ?? 2);
  const [deadline, setDeadline] = useState(dayOf(application?.deadline ?? null));
  const [fee, setFee] = useState(application?.fee ? String(application.fee.amount) : '');
  const [currency, setCurrency] = useState<Currency>(() => {
    const value = application?.fee?.currency ?? '';
    return isCurrency(value) ? value : '';
  });
  const [payment, setPayment] = useState<FeePayment>(application?.payment ?? 'pending');
  const [result, setResult] = useState<ApplicationResult | ''>(application?.result ?? '');
  const [note, setNote] = useState(application?.note ?? '');
  const [confirming, setConfirming] = useState(false);

  const amount = Number(toLatinNumber(fee));
  const feeValid = currency === '' || (fee.trim() !== '' && Number.isFinite(amount) && amount >= 0);
  const ready = university.trim() && program.trim() && feeValid;

  const submit = () => {
    const values: ApplicationInput = {
      university: university.trim(),
      program: program.trim(),
      degree,
      deadline: deadline || null,
      fee: currency ? { amount, currency } : null,
      payment: currency ? payment : null,
      result: result || null,
      note: note.trim() || null,
    };
    save.mutate(
      { application: application?.id ?? null, values },
      {
        onSuccess: onClose,
        onError: () => toast.error(t('saveError')),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={application ? t('appDialog.editTitle') : t('appDialog.newTitle')}
      subtitle={
        application ? <bdi>{`${application.university} · ${application.program}`}</bdi> : undefined
      }
      closeLabel={t('close')}
      footer={
        <>
          <Button disabled={!ready || save.isPending} onClick={submit}>
            {t('appDialog.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          {application && !confirming && (
            <Button variant="danger" className="ms-auto" onClick={() => setConfirming(true)}>
              {t('appDialog.delete')}
            </Button>
          )}
        </>
      }
    >
      {application && confirming && (
        <InlineConfirm
          message={t('appDialog.deleteConfirm', { name: application.university })}
          confirmLabel={t('appDialog.delete')}
          cancelLabel={t('cancel')}
          pending={remove.isPending}
          onConfirm={() =>
            remove.mutate(application.id, {
              onSuccess: onClose,
              onError: () => toast.error(t('saveError')),
            })
          }
          onCancel={() => setConfirming(false)}
        />
      )}
      <TextField
        label={t('appDialog.university')}
        dir="auto"
        value={university}
        onChange={(event) => setUniversity(event.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('appDialog.degree')}
          value={String(degree)}
          onChange={(value) => setDegree(DEGREES.find((item) => String(item) === value) ?? 2)}
          options={DEGREES.map((value) => ({ value: String(value), label: tc(`degree.${value}`) }))}
        />
        <TextField
          label={t('appDialog.program')}
          dir="auto"
          value={program}
          onChange={(event) => setProgram(event.target.value)}
        />
      </div>
      <DatePicker
        label={t('appDialog.deadline')}
        value={deadline}
        onChange={setDeadline}
        clearable
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('appDialog.currency')}
          value={currency}
          onChange={setCurrency}
          options={CURRENCIES.map((value) => ({
            value,
            label: value ? value : t('appDialog.noFee'),
          }))}
        />
        {currency && (
          <TextField
            label={t('appDialog.fee')}
            inputMode="decimal"
            dir="ltr"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
            error={feeValid ? undefined : t('appDialog.feeInvalid')}
          />
        )}
      </div>
      {currency && (
        <SelectField
          label={t('appDialog.payment')}
          value={payment}
          onChange={setPayment}
          options={FEE_PAYMENTS.map((value) => ({ value, label: t(`payment.${value}`) }))}
        />
      )}
      <SelectField
        label={t('appDialog.result')}
        value={result}
        onChange={setResult}
        options={[
          { value: '' as const, label: t('result.none') },
          ...APPLICATION_RESULTS.map((value) => ({ value, label: t(`result.${value}`) })),
        ]}
      />
      <TextAreaField
        label={t('appDialog.note')}
        hint={t('appDialog.noteHint')}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
      />
    </Dialog>
  );
}
