import { useEffect, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FileDrop, PickedFile } from '@/components/ui/Files';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { checkFile, extensionOf, type FileProblem } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import { MAX_RECEIPT_BYTES, RECEIPT_TYPES, useUploadReceipt, type PaymentData } from '../api';

const RULE = { types: RECEIPT_TYPES, maxBytes: MAX_RECEIPT_BYTES };
const INPUT_ID = 'payment-receipt';
const ERROR_ID = `${INPUT_ID}-error`;

/** Card transfer: the account to pay into (copyable), then the receipt file. */
export function ReceiptForm({ payment, onOnline }: { payment: PaymentData; onOnline: () => void }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const upload = useUploadReceipt();
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<{ problem: FileProblem; size: number } | null>(null);
  const [pickFirst, setPickFirst] = useState(false);

  const choose = (picked: File | undefined) => {
    setPickFirst(false);
    if (!picked) return;
    const found = checkFile(picked, RULE);
    setProblem(found ? { problem: found, size: picked.size } : null);
    setFile(found ? null : picked);
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!file) {
      setPickFirst(true);
      return;
    }
    send(file);
  };
  // On success the invoice turns to "in review" and the page shows that instead of this form.
  const send = (picked: File) =>
    upload.mutate({
      id: payment.id,
      file: picked,
      messages: { failed: t('payment.receipt.error'), retry: () => send(picked) },
    });

  return (
    <SectionCard
      variant="panel"
      id="payment-receipt-title"
      title={t('payment.receipt.title')}
      subtitle={t('payment.receipt.subtitle')}
    >
      <CopyRow label={t('payment.receipt.card')} value={payment.bank.card} />
      <CopyRow label={t('payment.receipt.iban')} value={payment.bank.iban} />
      <p className="m-0 text-sm">
        {t('payment.receipt.holder')} <b>{payment.bank.holder}</b>
      </p>

      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <label htmlFor={INPUT_ID} className="text-[15px] font-semibold">
            {t('payment.receipt.file')}
          </label>
          <span className="text-sm leading-7 text-text-2">
            {t('payment.receipt.hint', { size: f.fileSize(MAX_RECEIPT_BYTES) })}
          </span>
        </div>
        {file ? (
          <PickedFile
            ext={extensionOf(file.name)}
            name={file.name}
            meta={t('payment.receipt.ready', { size: f.fileSize(file.size) })}
            removeLabel={t('payment.receipt.remove')}
            disabled={upload.isPending}
            onRemove={() => setFile(null)}
          />
        ) : (
          <FileDrop
            id={INPUT_ID}
            accept={RECEIPT_TYPES}
            disabled={upload.isPending}
            errorId={problem ? ERROR_ID : null}
            chooseLabel={t('payment.receipt.choose')}
            hint={t('payment.receipt.dropHint')}
            touchHint={t('payment.receipt.dropHintTouch')}
            onFile={choose}
          />
        )}
        {problem && (
          <p id={ERROR_ID} className="m-0 text-sm leading-6 text-danger">
            {problem.problem === 'tooBig'
              ? t('payment.receipt.tooBig', {
                  size: f.fileSize(problem.size),
                  max: f.fileSize(MAX_RECEIPT_BYTES),
                })
              : t('payment.receipt.badType')}
          </p>
        )}
        {pickFirst && <Notice tone="error">{t('payment.receipt.pickFirst')}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="flex-[1_1_auto]"
            disabled={upload.isPending}
            onClick={onOnline}
          >
            {t('payment.receipt.toOnline')}
          </Button>
          <Button type="submit" className="flex-[2_1_auto]" disabled={upload.isPending}>
            {upload.isPending ? t('payment.receipt.sending') : t('payment.receipt.submit')}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

/** A number to copy into the banking app (card, IBAN). */
function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation('contract');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard
      .writeText(value.replace(/\s/g, ''))
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-canvas px-3.5 py-3">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs text-text-2">{label}</span>
        <span
          dir="ltr"
          className="text-sm font-bold tracking-[.04em] break-all tabular-nums lg:text-[17px] rtl:text-end"
        >
          {value}
        </span>
      </span>
      <Button
        variant="outline"
        className="flex-none px-3.5 text-[13px]"
        aria-label={t('payment.receipt.copyLabel', { name: label })}
        onClick={copy}
      >
        <span aria-live="polite">
          {copied ? t('payment.receipt.copied') : t('payment.receipt.copy')}
        </span>
      </Button>
    </div>
  );
}
