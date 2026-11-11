import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField } from '@/components/ui/Choices';
import { toast } from '@/lib/toast';
import { useMoveContract } from '../api';
import type { MonthContract } from '../api/month';

/** Moves one of a seller's contracts to another seller, with a reason the customer's history keeps. */
export function MoveContractForm({
  contract,
  sellers,
  onDone,
}: {
  contract: MonthContract;
  sellers: { id: number; name: string }[];
  onDone: () => void;
}) {
  const { t } = useTranslation('sales');
  const move = useMoveContract();
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const missing = !to || !reason.trim();

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    setChecked(true);
    if (missing) return;
    move.mutate(
      { lead: contract.lead, seller: Number(to), reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(t('manager.contracts.moved'));
          onDone();
        },
        onError: () => toast.error(t('error')),
      },
    );
  };

  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-4 px-5 py-5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
    >
      <h3 className="m-0 text-base font-bold">
        {t('manager.contracts.moveTitle', { name: contract.name })}
      </h3>
      <SelectField
        label={t('manager.contracts.to')}
        value={to}
        onChange={setTo}
        error={checked && !to ? t('manager.contracts.toRequired') : undefined}
        options={[
          { value: '', label: t('customer.logDialog.choose') },
          ...sellers.map((item) => ({ value: String(item.id), label: item.name })),
        ]}
      />
      <TextAreaField
        label={t('manager.contracts.reason')}
        hint={
          checked && !reason.trim()
            ? t('manager.contracts.reasonRequired')
            : t('manager.contracts.reasonHint')
        }
        value={reason}
        maxLength={1000}
        onChange={(event) => setReason(event.target.value)}
      />
      <span className="flex flex-wrap gap-2">
        <Button type="submit" disabled={move.isPending} aria-busy={move.isPending}>
          {t('manager.contracts.confirm')}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('manager.contracts.cancel')}
        </Button>
      </span>
    </form>
  );
}
