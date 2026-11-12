import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { FileDrop, PickedFile } from '@/components/ui/Files';
import { Notice } from '@/components/ui/Notice';
import { checkFile, extensionOf, type FileProblem } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  MAX_RECEIPT_BYTES,
  RECEIPT_TYPES,
  useInstalmentReceipt,
  type CustomerInstalment,
  type PaymentsData,
} from '../api';
import { useSalesFormat } from '../format';

const RULE = { types: RECEIPT_TYPES, maxBytes: MAX_RECEIPT_BYTES };
const DEFAULT_WALLET = 'default';

type Shown = CustomerInstalment['state'] | 'review';
const TONE: Record<Shown, ChipTone> = {
  paid: 'good',
  overdue: 'danger',
  due: 'warn',
  waiting: 'neutral',
  review: 'warn',
};

/**
 * The instalments of the customer's contract, and recording a receipt the customer sent the seller (by phone or a
 * messenger) on one: what the old site's "contract payments" page did. Paid at once for a seller who confirms
 * receipts, else it waits for their review.
 */
export function CustomerInstalments({ data }: { data: PaymentsData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const [open, setOpen] = useState<number | null>(null);
  if (data.instalments.length === 0) return null;

  return (
    <Card aria-labelledby="instalments-title">
      <div className="flex flex-col gap-1 px-5 pt-5 pb-3 lg:px-8 lg:pt-7">
        <h2 id="instalments-title" className="m-0 font-display text-xl font-bold">
          {t('payments.instalments.title')}
        </h2>
        <p className="m-0 text-sm leading-7 text-text-2">
          {t(
            data.confirms_receipts
              ? 'payments.instalments.subtitlePaid'
              : 'payments.instalments.subtitleReview',
          )}
        </p>
      </div>
      <ul className="m-0 list-none p-0 pb-2">
        {data.instalments.map((item) => {
          const shown: Shown = item.review ? 'review' : item.state;
          const recordable = item.state !== 'paid' && !item.review;
          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
                  <span className="text-base font-semibold">{item.title}</span>
                  <span className="text-sm text-text-2">
                    {item.due
                      ? t('payments.instalments.due', { date: f.date(item.due) })
                      : (item.condition ?? '')}
                  </span>
                </span>
                <span className="text-base font-bold tabular-nums">
                  {item.amount === null ? (item.amount_text ?? '') : s.toman(item.amount)}
                </span>
                <Chip tone={TONE[shown]} small>
                  {shown === 'review'
                    ? t('payments.instalments.review')
                    : t(`instalment.state.${shown}`)}
                </Chip>
                {recordable && open !== item.id && (
                  <Button
                    variant="outline"
                    aria-label={t('payments.instalments.recordFor', { title: item.title })}
                    onClick={() => setOpen(item.id)}
                  >
                    {t('payments.instalments.record')}
                  </Button>
                )}
              </div>
              {recordable && open === item.id && (
                <ReceiptForm
                  instalment={item}
                  wallets={item.amount === null ? [] : data.wallets}
                  confirms={data.confirms_receipts}
                  onClose={() => setOpen(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ReceiptForm({
  instalment,
  wallets,
  confirms,
  onClose,
}: {
  instalment: CustomerInstalment;
  wallets: PaymentsData['wallets'];
  confirms: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const upload = useInstalmentReceipt();
  const [file, setFile] = useState<File | null>(null);
  const [wallet, setWallet] = useState(DEFAULT_WALLET);
  const [problem, setProblem] = useState<{ problem: FileProblem; size: number } | null>(null);
  const [pickFirst, setPickFirst] = useState(false);
  const inputId = `instalment-receipt-${String(instalment.id)}`;
  const errorId = `${inputId}-error`;

  const choose = (picked: File | undefined) => {
    setPickFirst(false);
    if (!picked) return;
    const found = checkFile(picked, RULE);
    setProblem(found ? { problem: found, size: picked.size } : null);
    setFile(found ? null : picked);
  };

  const send = (picked: File) =>
    upload.mutate(
      {
        instalment: instalment.id,
        file: picked,
        wallet: wallet === DEFAULT_WALLET ? null : Number(wallet),
        messages: {
          done: t(confirms ? 'payments.instalments.donePaid' : 'payments.instalments.doneReview'),
          failed: t('payments.instalments.failed'),
          retry: () => send(picked),
        },
      },
      { onSuccess: onClose },
    );

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!file) {
      setPickFirst(true);
      return;
    }
    send(file);
  };

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={t('payments.instalments.formLabel', { title: instalment.title })}
      className="flex flex-col gap-3 rounded-2xl bg-canvas p-4"
    >
      {wallets.length > 0 && (
        <SelectField
          label={t('payments.instalments.wallet')}
          value={wallet}
          onChange={setWallet}
          options={[
            { value: DEFAULT_WALLET, label: t('payments.instalments.walletDefault') },
            ...wallets.map((item) => ({ value: String(item.id), label: item.name })),
          ]}
        />
      )}
      <div className="flex flex-col gap-0.5">
        <label htmlFor={inputId} className="text-[15px] font-semibold">
          {t('payments.instalments.file')}
        </label>
        <span className="text-sm leading-7 text-text-2">
          {t('payments.instalments.hint', { size: f.fileSize(MAX_RECEIPT_BYTES) })}
        </span>
      </div>
      {file ? (
        <PickedFile
          ext={extensionOf(file.name)}
          name={file.name}
          meta={f.fileSize(file.size)}
          removeLabel={t('payments.instalments.remove')}
          disabled={upload.isPending}
          onRemove={() => setFile(null)}
        />
      ) : (
        <FileDrop
          id={inputId}
          accept={RECEIPT_TYPES}
          disabled={upload.isPending}
          errorId={problem ? errorId : null}
          chooseLabel={t('payments.instalments.choose')}
          hint={t('payments.instalments.dropHint')}
          touchHint={t('payments.instalments.dropHintTouch')}
          onFile={choose}
          compact
        />
      )}
      {problem && (
        <p id={errorId} className="m-0 text-sm leading-6 text-danger">
          {problem.problem === 'tooBig'
            ? t('payments.instalments.tooBig', {
                size: f.fileSize(problem.size),
                max: f.fileSize(MAX_RECEIPT_BYTES),
              })
            : t('payments.instalments.badType')}
        </p>
      )}
      {pickFirst && <Notice tone="error">{t('payments.instalments.pickFirst')}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={upload.isPending}>
          {upload.isPending ? t('payments.instalments.sending') : t('payments.instalments.submit')}
        </Button>
        <Button variant="outline" disabled={upload.isPending} onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
