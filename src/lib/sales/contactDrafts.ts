import { useSyncExternalStore } from 'react';
import { queryClient } from '@/lib/api/queryClient';
import { sessionQuery } from '@/lib/auth/session';
import type { Channel, LostReason } from './api';
import type { ObservedCall } from './phoneCalls';

/** The consultation a meeting log is for, shown at the top of the form. */
export interface LogSession {
  /** The consultation type's name. */
  title?: string | undefined;
  starts_at: string;
  minutes?: number | null | undefined;
  mode?: 'online' | 'in_person' | undefined;
}

export interface LogStart {
  channel: Channel;
  reservation?: number | undefined;
  session?: LogSession | undefined;
}

export interface ContactValues {
  channel: Channel;
  outcome: 'talked' | 'no_answer' | 'call_later' | 'wrong_number';
  stage: 'keep' | 'contacted' | 'consulted' | 'offer' | 'lost';
  lostReason: LostReason | '';
  notes: string;
  customerSummary?: string;
  voiceTranscript?: string;
  customerSummaryVoiceTranscript?: string;
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
  call?: ObservedCall;
}
export interface ContactWorkspaceState {
  owner: number | null;
  drafts: ContactDraft[];
  active: string | null;
  unknownCalls: ObservedCall[];
  activeUnknown: string | null;
  seenCalls: string[];
}
const STORAGE_KEY = 'scorize.contact-drafts.v1';
const empty = (): ContactWorkspaceState => ({
  owner: null,
  drafts: [],
  active: null,
  unknownCalls: [],
  activeUnknown: null,
  seenCalls: [],
});
let state = empty();
const listeners = new Set<() => void>();
function commit(next: ContactWorkspaceState) {
  state = next;
  try {
    if (
      next.owner === null ||
      (next.drafts.length === 0 && next.unknownCalls.length === 0 && next.seenCalls.length === 0)
    )
      sessionStorage.removeItem(STORAGE_KEY);
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
  let seenCalls: string[] = [];
  let unknownCalls: ObservedCall[] = [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as ContactWorkspaceState) : null;
    if (saved?.owner === owner && Array.isArray(saved.drafts)) {
      drafts = saved.drafts.filter(
        (draft) =>
          typeof draft.key === 'string' &&
          Number.isSafeInteger(draft.customer) &&
          typeof draft.name === 'string' &&
          ['call', 'meeting', 'whatsapp', 'telegram', 'sms'].includes(draft.values.channel),
      );
      seenCalls = Array.isArray(saved.seenCalls)
        ? saved.seenCalls.filter((id) => typeof id === 'string').slice(-256)
        : [];
      unknownCalls = Array.isArray(saved.unknownCalls)
        ? saved.unknownCalls.filter(
            (call) => typeof call.id === 'string' && typeof call.phone === 'string',
          )
        : [];
    }
  } catch {
    // An invalid saved draft does not prevent the panel from opening.
  }
  commit({ owner, drafts, active: null, unknownCalls, activeUnknown: null, seenCalls });
}

export function clearContactDrafts() {
  commit(empty());
}

/** `values`: answers already given (the Today card's one-click outcome), over the defaults. */
export function openContactLog(
  customer: number,
  name: string,
  start: LogStart,
  values: Partial<ContactValues> = {},
) {
  const user = queryClient.getQueryData(sessionQuery.queryKey);
  if (!user) return;
  restoreContactDrafts(user.id);
  const live =
    start.channel === 'call' &&
    !start.reservation &&
    state.drafts.find(
      (draft) => draft.customer === customer && draft.call && draft.call.ended_at === null,
    );
  const key = live ? live.key : `${customer}:${start.reservation ?? start.channel}`;
  if (state.drafts.some((draft) => draft.key === key)) {
    commit({
      ...state,
      drafts: state.drafts.map((draft) =>
        draft.key === key ? { ...draft, values: { ...draft.values, ...values } } : draft,
      ),
      active: key,
      activeUnknown: null,
    });
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
      // A held session usually moves the lead to "consulted" (the seller can change it).
      stage: start.reservation ? 'consulted' : 'keep',
      lostReason: '',
      notes: '',
      customerSummary: '',
      follow: 'tomorrow',
      date: '',
      email: false,
      ...values,
    },
  };
  commit({ ...state, drafts: [...state.drafts, draft], active: key, activeUnknown: null });
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
  commit({ ...state, active: key, activeUnknown: null });
}

export function activateUnknownCall(id: string | null) {
  commit({ ...state, active: null, activeUnknown: id });
}

export function dismissUnknownCall(id: string) {
  commit({
    ...state,
    unknownCalls: state.unknownCalls.filter((call) => call.id !== id),
    activeUnknown: state.activeUnknown === id ? null : state.activeUnknown,
  });
}

/** Shared update boundary for optional live-call synchronization. */
export function updateContactWorkspace(
  change: (current: ContactWorkspaceState) => ContactWorkspaceState,
) {
  commit(change(state));
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
