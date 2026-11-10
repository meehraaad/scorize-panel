import { useQuery } from '@tanstack/react-query';
import { lazy } from 'react';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { phoneBreakQuery } from '@/lib/sales/phoneCalls';

/**
 * The seller's state for the avatar ring: `queue` (green) while team calls can reach them, `rest`
 * (orange) while on a break from team calls, otherwise null (no team rings them). Kept tiny: the
 * panel's frame loads it on every page.
 */
export function usePhoneStatus(): 'queue' | 'rest' | null {
  const { data } = useQuery({ ...phoneBreakQuery, enabled: ON_SERVER.phoneBreak });
  if (!data?.can) return null;
  return data.on_break ? 'rest' : 'queue';
}

/** The break button and status in the account menu: opens with the menu, so it stays out of the first load. */
export const PhoneBreakMenu = lazy(() => import('./PhoneBreak'));
