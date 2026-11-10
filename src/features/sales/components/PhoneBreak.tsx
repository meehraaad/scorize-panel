import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { phoneBreakQuery, useSetPhoneBreak } from '@/lib/sales/phoneCalls';
import { toast } from '@/lib/toast';

function useBreak() {
  const { t } = useTranslation('sales');
  const { data } = useQuery(phoneBreakQuery);
  const set = useSetPhoneBreak();
  const toggle = (onBreak: boolean) =>
    set.mutate(onBreak, {
      onSuccess: () => toast.success(t(onBreak ? 'phoneBreak.started' : 'phoneBreak.ended')),
      onError: () => toast.error(t('error')),
    });
  return { data, toggle, pending: set.isPending };
}

/**
 * Today's header button: a break from team calls (lunch, a meeting) and back. Only for sellers a
 * team can ring (a desk phone or a mobile extension).
 */
export function PhoneBreakButton() {
  const { t } = useTranslation('sales');
  const { data, toggle, pending } = useBreak();
  if (!data?.can) return null;
  return data.on_break ? (
    <Button onClick={() => toggle(false)} disabled={pending}>
      <Icon name="phone" size={18} />
      {t('phoneBreak.end')}
    </Button>
  ) : (
    <Button
      variant="outline"
      onClick={() => toggle(true)}
      disabled={pending}
      title={t('phoneBreak.hint')}
    >
      <Icon name="pause" size={18} />
      {t('phoneBreak.start')}
    </Button>
  );
}

/** While on a break: what it means, under the header. */
export function PhoneBreakNotice() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useBreak();
  if (!data?.on_break || !data.since) return null;
  return (
    <Notice tone="info">
      {t('phoneBreak.on', { time: f.time(data.since) })}{' '}
      {data.teams.length > 0 && t('phoneBreak.teams', { teams: f.list(data.teams) })}{' '}
      {t('phoneBreak.direct')}
    </Notice>
  );
}
