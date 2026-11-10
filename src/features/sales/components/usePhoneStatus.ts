import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useSession } from '@/lib/auth/session';
import {
  isActiveCall,
  phoneBreakQuery,
  phoneCallsQuery,
  useSetPhoneBreak,
} from '@/lib/sales/phoneCalls';
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

/** True while the seller is on a connected call (same query as the workspace's live-call listener). */
export function useOnCall() {
  const user = useSession();
  const { data } = useQuery({
    ...phoneCallsQuery(user?.id ?? 0),
    enabled: ON_SERVER.livePhoneCalls && Boolean(user),
  });
  return Boolean(data?.calls.some((call) => isActiveCall(call) && call.status === 'connected'));
}

/**
 * The seller's phone state for the avatar ring: `call` (green) while on a connected call, `rest`
 * (orange) while on a break from team calls, otherwise null. A call wins over a break.
 */
export function usePhoneStatus(): 'call' | 'rest' | null {
  const onCall = useOnCall();
  const { data } = useBreak();
  if (onCall) return 'call';
  return data?.on_break ? 'rest' : null;
}
