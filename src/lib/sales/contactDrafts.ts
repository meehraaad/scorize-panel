import { useSyncExternalStore } from 'react';
import { queryClient } from '@/lib/api/queryClient';
import { sessionQuery } from '@/lib/auth/session';
import type { Channel, LostReason } from './api';

export interface LogStart {
  channel: Channel;
  reservation?: number | undefined;
}

export interface ContactValues {
  channel: Channel;
  outcome: 'talked' | 'no_answer' | 'call_later' | 'wrong_number';
  stage: 'keep' | 'contacted' | 'consulted' | 'offer' | 'lost';
  lostReason: LostReason | '';
  notes: string;
  customerSummary?: string;
  follow: 'evening' | 'tomorrow' | 'three' | 'week' | 'other';
  date: string;
  email: boolean;
  template?: string;
}

export interface ContactDraft {
  key: string;
  customer: number;
  name: string;
  start: LogStart;
  values: ContactValues;
}
interface Workspace {
  owner: number | null;
  drafts: ContactDraft[];
  active: string | null;
}
const STORAGE_KEY = 'scorize.contact-drafts.v1';
const empty = (): Workspace => ({ owner: null, drafts: [], active: null });
let state = empty();
const listeners = new Set<() => void>();
function commit(next: Workspace) {
  state = next;
  try {
    if (next.owner === null || next.drafts.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Blocked or full storage: drafts still survive page navigation in memory.
  }
  listeners.forEach((listener) => listener());
}

/** Called only after whoami identifies the account. Restore minimized, never over a new page. */
export function restoreContactDrafts(owner: number) {
  if (state.owner === owner) return;
  let drafts: ContactDraft[] = [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Workspace) : null;
    if (saved?.owner === owner && Array.isArray(saved.drafts)) {
      drafts = saved.drafts.filter(
        (draft) =>
          typeof draft.key === 'string' &&
          Number.isSafeInteger(draft.customer) &&
          typeof draft.name === 'string' &&
          ['call', 'meeting', 'whatsapp', 'telegram', 'sms'].includes(draft.values.channel),
      );
    }
  } catch {
    // An invalid saved draft does not prevent the panel from opening.
  }
  commit({ owner, drafts, active: null });
}

export function clearContactDrafts() {
  commit(empty());
}

export function openContactLog(customer: number, name: string, start: LogStart) {
  const user = queryClient.getQueryData(sessionQuery.queryKey);
  if (!user) return;
  restoreContactDrafts(user.id);
  const key = `${customer}:${start.reservation ?? start.channel}`;
  if (state.drafts.some((draft) => draft.key === key)) {
    commit({ ...state, active: key });
    return;
  }
  const draft: ContactDraft = {
    key,
    customer,
    name,
    start,
    values: {
      channel: start.channel,
      outcome: 'talked',
      stage: 'keep',
      lostReason: '',
      notes: '',
      customerSummary: '',
      follow: 'tomorrow',
      date: '',
      email: false,
    },
  };
  commit({ ...state, drafts: [...state.drafts, draft], active: key });
}
export function updateContactDraft(key: string, change: Partial<ContactValues>) {
  commit({
    ...state,
    drafts: state.drafts.map((draft) =>
      draft.key === key ? { ...draft, values: { ...draft.values, ...change } } : draft,
    ),
  });
}
export function nameContactDraft(key: string, name: string) {
  commit({
    ...state,
    drafts: state.drafts.map((draft) => (draft.key === key ? { ...draft, name } : draft)),
  });
}
export function activateContactDraft(key: string | null) {
  commit({ ...state, active: key });
}
export function removeContactDraft(key: string) {
  commit({
    ...state,
    drafts: state.drafts.filter((draft) => draft.key !== key),
    active: state.active === key ? null : state.active,
  });
}
export function useContactDrafts() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
