import { dehydrate, hydrate, type DehydratedState } from '@tanstack/react-query';
import i18n from '@/lib/i18n';
import { queryClient } from './queryClient';

/*
 * The query cache survives a reload of the tab (docs/performance.md, "Cache"): pages open at once
 * from the last answers and refresh behind them. Kept safe:
 * - sessionStorage: this tab only, gone when it closes; never shared with other tabs or visits.
 * - Restored only after the session check names the same user it was saved for, so another
 *   account in this browser never sees it. The session itself is never saved.
 * - Logout and login wipe it; an hour old, another language or another build discards it.
 */

const KEY = 'scorize.cache';
const MAX_AGE_MS = 60 * 60_000;
const MAX_BYTES = 2_000_000;
const WRITE_MS = 1000;
const BUILD = import.meta.env.VITE_APP_BUILD ?? 'dev';

interface Saved {
  build: string;
  user: number;
  language: string;
  savedAt: number;
  state: DehydratedState;
}

const storage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null; // Storage blocked (privacy settings): nothing is kept.
  }
};

let saved: Saved | null = null;
let user: number | null = null;

/** Read what this tab saved before the reload, and keep saving from now on. Call once at boot. */
export function startCachePersistence() {
  try {
    const raw = storage()?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Saved) : null;
    saved =
      parsed &&
      parsed.build === BUILD &&
      parsed.language === i18n.language &&
      Date.now() - parsed.savedAt < MAX_AGE_MS
        ? parsed
        : null;
  } catch {
    saved = null;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  queryClient.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(write, WRITE_MS);
  });
  window.addEventListener('pagehide', write);
}

/**
 * The session check named this user: put back the answers saved for them (only once, and only
 * older than anything already fetched). Answers saved for anyone else are dropped.
 */
export function restoreCacheFor(id: number) {
  user = id;
  const restore = saved;
  saved = null;
  if (restore?.user === id) hydrate(queryClient, restore.state);
}

/** Logout and login: nothing from this account stays in the tab. */
export function clearPersistedCache() {
  saved = null;
  user = null;
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

function write() {
  if (user === null) return;
  const state = dehydrate(queryClient, {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && query.queryKey[0] !== 'session',
  });
  const value: Saved = { build: BUILD, user, language: i18n.language, savedAt: Date.now(), state };
  try {
    const json = JSON.stringify(value);
    if (json.length > MAX_BYTES) storage()?.removeItem(KEY);
    else storage()?.setItem(KEY, json);
  } catch {
    // Full or blocked: the next visit simply loads from the network.
  }
}
