import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from './approval';

/**
 * What the logged-in user may use in the applicant panel (docs/backend-changes.md H28). Every
 * account has the panel; without an active contract its sections show a locked preview (canvas V7).
 */

/**
 * - `active`: a running contract
 * - `guest`: no contract (or no applicant file)
 * - `pending`: a contract was registered and the team hasn't approved it yet
 * - `ended`: the contract is over; the case is read-only
 */
export type AccessState = 'active' | 'guest' | 'pending' | 'ended';

/** Contract.has_*_features that are on. */
export type ContractFeature = 'admission' | 'writing' | 'visa';

export interface ApplicantAccess {
  state: AccessState;
  /** Services of the contract (empty without one). */
  features: ContractFeature[];
  /** Destination countries of the contract, localized (empty without one). */
  countries: string[];
  /** The account's phone, to prefill the call request. */
  phone: string | null;
  /**
   * The free Turkey application, while one is under way (before signing): its step, for the guest
   * home's card. null when none was started or once the case has begun.
   */
  turkey: 'docs' | 'review' | 'sign' | null;
  /**
   * While `pending`: the prepayment to pay before a supervisor takes the case (S46), toman.
   * null otherwise, and for contracts registered before this flow.
   */
  prepayment: {
    payment_id: number;
    amount: number;
    status: 'unpaid' | 'review' | 'declined' | 'paid';
  } | null;
}

/** Sections of the applicant panel that can be locked (their nav item ids). */
export const LOCKABLE = ['applications', 'documents', 'tickets', 'contract'] as const;
export type LockableSection = (typeof LOCKABLE)[number];

/** Why a section is locked; null when it is open. */
export type Lock = 'guest' | 'pending' | 'noservice' | 'ended';

export const accessQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'access'],
  queryFn: ({ signal }) => api<ApplicantAccess>('/applicant/v1/access/', { signal }),
  staleTime: 5 * 60_000,
});

/** Why `section` is locked for this user, or null. */
export function lockOf(access: ApplicantAccess, section: LockableSection): Lock | null {
  if (access.state !== 'active') return access.state;
  // Applications and results need the admission service.
  if (section === 'applications' && !access.features.includes('admission')) return 'noservice';
  return null;
}

/**
 * Nav items not shown: the tickets tab, until the user has a contract (a writing order without one
 * opens its tickets from the writing forms). Nothing is hidden while access is loading.
 */
export function useHiddenNav(): ReadonlySet<string> {
  const { data } = useQuery(accessQuery);
  return data?.state === 'guest' ? NO_CONTRACT : NONE;
}
const NO_CONTRACT: ReadonlySet<string> = new Set(['tickets']);
const NONE: ReadonlySet<string> = new Set();

export const CALL_TOPICS = ['admission', 'visa', 'turkey', 'writing'] as const;
export type CallTopic = (typeof CALL_TOPICS)[number];
export const CALL_TIMES = ['morning', 'noon', 'evening'] as const;
export type CallTime = (typeof CALL_TIMES)[number];

export interface CallRequest {
  phone: string;
  topics: CallTopic[];
  time: CallTime;
  /** Where it was asked from (the section), for the sales team's lead. */
  page: string;
  /** `guest`: wants a contract; `add_service`: wants a service added; `ended`: a next step. */
  reason: 'guest' | 'add_service' | 'ended';
}

/** "Call me": creates a lead for the sales team (H29). */
export function useCallRequest() {
  return useMutation({
    mutationFn: (request: CallRequest) =>
      api('/applicant/v1/call-request/', { method: 'POST', body: request }),
  });
}
