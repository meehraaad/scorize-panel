import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { type KpiResults, type PayMonth } from '../api';
import { useCloseMonth, useReopenMonth } from '../mutations';
import { parseNumber } from '../numbers';

/**
 * Closing a month's KPIs for review: the values stop being measured, managers check them and each
 * person can object (on their «من» page) for a few days. Shown in the month bar of «نتیجه‌ها».
 */
export function MonthReview({ month, data }: { month: PayMonth; data: KpiResults }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const reopen = useReopenMonth();
  const [closing, setClosing] = useState(false);
  if (data.final) return null;
  if (!data.closed)
    return (
      <>
        <Button variant="outline" onClick={() => setClosing(true)}>
          {t('pay.review.close')}
        </Button>
        {closing && <CloseDialog month={month} onClose={() => setClosing(false)} />}
      </>
    );
  return (
    <>
      <Chip tone="info" dot>
        {data.disputes_until
          ? t('pay.review.closedUntil', { date: f.date(data.disputes_until) })
          : t('pay.review.closed')}
      </Chip>
      <Button
        variant="outline"
        disabled={reopen.isPending}
        onClick={() =>
          reopen.mutate(month, {
            onSuccess: () => toast.success(t('pay.review.reopened')),
            onError: () => toast.error(t('error')),
          })
        }
      >
        {t('pay.review.reopen')}
      </Button>
    </>
  );
}

function CloseDialog({ month, onClose }: { month: PayMonth; onClose: () => void }) {
  const { t } = useTranslation('hr');
  const close = useCloseMonth();
  const [days, setDays] = useState('3');
  const parsed = parseNumber(days);
  const valid = parsed !== null && Number.isInteger(parsed) && parsed >= 0 && parsed <= 30;
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('pay.review.closeTitle')}
      closeLabel={t('close')}
      footer={
        <Button
          disabled={!valid || close.isPending}
          onClick={() =>
            valid &&
            close.mutate(
              { ...month, days: parsed },
              {
                onSuccess: () => {
                  toast.success(t('pay.review.closedToast'));
                  onClose();
                },
                onError: () => toast.error(t('error')),
              },
            )
          }
        >
          {t('pay.review.close')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[15px] leading-7 text-text-2">{t('pay.review.closeHint')}</p>
        <TextField
          label={t('pay.review.days')}
          hint={t('pay.review.daysHint')}
          inputMode="numeric"
          dir="ltr"
          value={days}
          error={valid ? undefined : t('pay.review.daysRange')}
          onChange={(event) => setDays(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
