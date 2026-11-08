import { useQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { toast } from '@/lib/toast';
import { teamContractsQuery, useMoveContract, type TeamRange } from '../api';
import type { MonthContract } from '../api/month';
import { ContractList } from '../components/MonthLists';

/**
 * A seller's contracts over the team page's range: what makes their number on the leaderboard.
 * The manager can move one to another seller, with a reason the customer's history keeps.
 */
export function SellerContracts({
  range,
  seller,
  sellers,
  onClose,
}: {
  range: TeamRange;
  seller: { id: number; name: string } | null;
  sellers: { id: number; name: string }[];
  onClose: () => void;
}) {
  const { t } = useTranslation('sales');
  const { data } = useQuery({
    ...teamContractsQuery(range, seller?.id ?? 0),
    enabled: seller !== null,
  });
  const [moving, setMoving] = useState<MonthContract | null>(null);

  return (
    <Dialog
      open={seller !== null}
      onClose={() => {
        setMoving(null);
        onClose();
      }}
      title={t('manager.contracts.title', { name: seller?.name ?? '' })}
      subtitle={t('manager.contracts.subtitle')}
      closeLabel={t('manager.contracts.close')}
      size="wide"
    >
      {!data ? (
        <SkeletonRows rows={3} />
      ) : (
        <ContractList
          rows={data}
          empty={t('manager.contracts.empty')}
          action={(row) =>
            moving?.lead === row.lead ? null : (
              <Button
                variant="outline"
                className="h-11 px-4 text-sm"
                aria-label={t('manager.contracts.moveFor', { name: row.name })}
                onClick={() => setMoving(row)}
              >
                {t('manager.contracts.move')}
              </Button>
            )
          }
        />
      )}
      {moving && seller && (
        <MoveForm
          contract={moving}
          sellers={sellers.filter((item) => item.id !== seller.id)}
          onDone={() => setMoving(null)}
        />
      )}
    </Dialog>
  );
}

function MoveForm({
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
