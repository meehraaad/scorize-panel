import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { FileDrop, FileTile } from '@/components/ui/Files';
import { StepBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { checkFile, extensionOf, type FileProblem } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import {
  HANDOFF_STEPS,
  MAX_SCAN_BYTES,
  SCAN_TYPES,
  handoffQuery,
  useUploadScan,
  type HandoffContract,
  type Prepayment,
} from '../api';
import { useSalesFormat } from '../format';

const RULE = { types: SCAN_TYPES, maxBytes: MAX_SCAN_BYTES };
const INPUT_ID = 'contract-scan';
const ERROR_ID = `${INPUT_ID}-error`;
const PAYMENT_TONE: Record<Prepayment['status'], ChipTone> = {
  unpaid: 'warn',
  review: 'info',
  declined: 'danger',
  paid: 'good',
};

/**
 * The approved contract until its case starts (S44, S45): signed on paper and scanned here, the
 * prepayment paid by the customer, then a manager hands the case to a supervisor. Nothing shows
 * without an approved contract.
 */
export function ContractHandoff({ customer }: { customer: number }) {
  const { data } = useSuspenseQuery(handoffQuery(customer));
  if (!data.contract) return null;
  return <HandoffCard customer={customer} contract={data.contract} />;
}

function HandoffCard({ customer, contract }: { customer: number; contract: HandoffContract }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const upload = useUploadScan(customer);
  const [problem, setProblem] = useState<{ problem: FileProblem; size: number } | null>(null);
  const active = contract.state === 'active';

  const send = (file: File) =>
    upload.mutate({
      file,
      messages: { failed: t('handoff.scan.error'), retry: () => send(file) },
    });
  const choose = (picked: File | undefined) => {
    if (!picked) return;
    const found = checkFile(picked, RULE);
    setProblem(found ? { problem: found, size: picked.size } : null);
    if (!found) send(picked);
  };

  return (
    <SectionCard
      id="contract-handoff"
      variant="panel"
      title={t('handoff.title')}
      subtitle={t(`handoff.state.${contract.state}`, {
        supervisors: f.list(contract.supervisors),
      })}
    >
      <StepBar
        label={t('handoff.steps')}
        steps={HANDOFF_STEPS.map((step) => ({ key: step, label: t(`handoff.step.${step}`) }))}
        current={HANDOFF_STEPS.indexOf(contract.state)}
        finished={active}
      />

      {contract.prepayment && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-canvas px-4 py-3">
          <span className="text-sm">
            {t('handoff.prepayment', { amount: s.toman(contract.prepayment.amount) })}
          </span>
          <Chip tone={PAYMENT_TONE[contract.prepayment.status]} small>
            {t(`handoff.payment.${contract.prepayment.status}`)}
          </Chip>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <h3 className="m-0 text-sm font-semibold text-text-2">{t('handoff.scan.title')}</h3>
        {contract.scans.map((scan, index) => (
          <FileTile
            key={scan.id}
            ext={extensionOf(scan.url)}
            name={t('handoff.scan.name', { n: f.number(index + 1) })}
            href={safeHref(scan.url) ?? '#'}
            meta={f.timeAgo(scan.uploaded_at)}
          />
        ))}
        {!active && (
          <>
            <span className="text-sm leading-7 text-text-2">
              {t('handoff.scan.hint', { size: f.fileSize(MAX_SCAN_BYTES) })}
            </span>
            <FileDrop
              id={INPUT_ID}
              accept={SCAN_TYPES}
              disabled={upload.isPending}
              errorId={problem ? ERROR_ID : null}
              chooseLabel={
                contract.scans.length ? t('handoff.scan.more') : t('handoff.scan.choose')
              }
              inputLabel={t('handoff.scan.title')}
              hint={t('handoff.scan.dropHint')}
              touchHint={t('handoff.scan.dropHintTouch')}
              onFile={choose}
            />
            {problem && (
              <p id={ERROR_ID} className="m-0 text-sm leading-6 text-danger">
                {problem.problem === 'tooBig'
                  ? t('handoff.scan.tooBig', {
                      size: f.fileSize(problem.size),
                      max: f.fileSize(MAX_SCAN_BYTES),
                    })
                  : t('handoff.scan.badType')}
              </p>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}
