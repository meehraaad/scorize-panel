import { useSyncExternalStore } from 'react';
import { queryClient } from '@/lib/api/queryClient';
import { sessionQuery } from '@/lib/auth/session';

/**
 * The supervisor's chat windows: one applicant's tickets in a floating window that stays open
 * while the supervisor moves around the panel (like the seller panel's call drafts). One window is
 * open; the others wait minimized at the bottom of the screen with their unsent text.
 */
export interface CaseChat {
  /** The case (applicant) id. */
  case: number;
  name: string;
  /** The thread shown ('supervisor', 'writing/sop'); null: the case's first thread. */
  thread: string | null;
  /** Text typed and not sent yet. */
  draft: string;
}

interface Dock {
  owner: number | null;
  chats: CaseChat[];
  active: number | null;
}

/** More than this many windows: the oldest minimized one without unsent text closes. */
export const MAX_CHATS = 5;

const STORAGE_KEY = 'scorize.case-chats.v1';
const empty = (): Dock => ({ owner: null, chats: [], active: null });
let state = empty();
const listeners = new Set<() => void>();

function commit(next: Dock) {
  state = next;
  try {
    if (next.owner === null || next.chats.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Blocked or full storage: the windows still survive page navigation in memory.
  }
  listeners.forEach((listener) => listener());
}

const isChat = (value: unknown): value is CaseChat => {
  if (typeof value !== 'object' || value === null) return false;
  const chat = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(chat.case) &&
    typeof chat.name === 'string' &&
    (chat.thread === null || typeof chat.thread === 'string') &&
    typeof chat.draft === 'string'
  );
};

/** Called once whoami names the account. Windows come back minimized, never over a new page. */
export function restoreCaseChats(owner: number) {
  if (state.owner === owner) return;
  let chats: CaseChat[] = [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Dock>) : null;
    if (saved?.owner === owner && Array.isArray(saved.chats))
      chats = saved.chats.filter(isChat).slice(-MAX_CHATS);
  } catch {
    // A broken saved list does not keep the panel from opening.
  }
  commit({ owner, chats, active: null });
}

export function clearCaseChats() {
  commit(empty());
}

/** Opens (or brings back) the chat with this applicant, on `thread` when given. */
export function openCaseChat(id: number, name: string, thread: string | null = null) {
  const user = queryClient.getQueryData(sessionQuery.queryKey);
  if (!user) return;
  restoreCaseChats(user.id);
  const known = state.chats.find((chat) => chat.case === id);
  if (known) {
    commit({
      ...state,
      chats: state.chats.map((chat) =>
        chat.case === id ? { ...chat, name, thread: thread ?? chat.thread } : chat,
      ),
      active: id,
    });
    return;
  }
  let chats = [...state.chats, { case: id, name, thread, draft: '' }];
  while (chats.length > MAX_CHATS) {
    const drop =
      chats.find((chat) => chat.case !== id && !chat.draft.trim()) ??
      chats.find((chat) => chat.case !== id);
    if (!drop) break;
    chats = chats.filter((chat) => chat !== drop);
  }
  commit({ ...state, chats, active: id });
}

/** Shows this chat's window (null: minimizes the open one). */
export function activateCaseChat(id: number | null) {
  commit({ ...state, active: id });
}

export function closeCaseChat(id: number) {
  commit({
    ...state,
    chats: state.chats.filter((chat) => chat.case !== id),
    active: state.active === id ? null : state.active,
  });
}

export function setCaseChatThread(id: number, thread: string) {
  commit({
    ...state,
    chats: state.chats.map((chat) => (chat.case === id ? { ...chat, thread } : chat)),
  });
}

export function setCaseChatDraft(id: number, draft: string) {
  const chat = state.chats.find((item) => item.case === id);
  if (!chat || chat.draft === draft) return;
  commit({
    ...state,
    chats: state.chats.map((item) => (item.case === id ? { ...item, draft } : item)),
  });
}

export function useCaseChats() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
