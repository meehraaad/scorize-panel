import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { phoneBreakQuery, useSetPhoneBreak } from '@/lib/sales/phoneCalls';
import { toast } from '@/lib/toast';

export function useBreak() {
  const { t } = useTranslation('sales');
  const { data } = useQuery({ ...phoneBreakQuery, enabled: ON_SERVER.phoneBreak });
  const set = useSetPhoneBreak();
  const toggle = (onBreak: boolean) =>
    set.mutate(onBreak, {
      onSuccess: () => toast.success(t(onBreak ? 'phoneBreak.started' : 'phoneBreak.ended')),
      onError: () => toast.error(t('error')),
    });
  return { data, toggle, pending: set.isPending };
}

/**
 * The seller's state for the avatar ring: `queue` (green) while team calls can reach them, `rest`
 * (orange) while on a break from team calls, otherwise null (no team rings them).
 */
export function usePhoneStatus(): 'queue' | 'rest' | null {
  const { data } = useBreak();
  if (!data?.can) return null;
  return data.on_break ? 'rest' : 'queue';
}
