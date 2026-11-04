import { useTranslation } from 'react-i18next';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { callDuration, callSeconds, type ObservedCall } from '@/lib/sales/phoneCalls';
import { useNow } from '../useNow';

export function CallStatus({ call, compact = false }: { call: ObservedCall; compact?: boolean }) {
  const { t } = useTranslation('sales');
  const format = useFormat();
  const now = useNow();
  const duration = callDuration(callSeconds(call, now));
  const timer = (
    <span dir="ltr" className="font-mono tabular-nums" aria-label={t('phoneCall.duration')}>
      {format.digits(duration)}
    </span>
  );
  if (compact)
    return (
      <span className="inline-flex items-center gap-2 text-sm text-text-2">
        <span>{t(`phoneCall.status.${call.status}`)}</span>
        {timer}
      </span>
    );
  return (
    <div className="flex flex-col gap-3 rounded-card border border-hair bg-canvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span role="status">{t(`phoneCall.status.${call.status}`)}</span>
        {timer}
      </div>
      <p className="text-sm text-text-2">
        {t(`phoneCall.direction.${call.direction}`)}
        {' · '}
        {t('phoneCall.extension', { extension: format.digits(call.extension) })}
      </p>
      <span dir="ltr" className="self-start text-sm">
        {format.digits(call.phone)}
      </span>
      {!call.connected && !call.ended_at && (
        <Notice tone="info">{t('phoneCall.disconnected')}</Notice>
      )}
    </div>
  );
}
