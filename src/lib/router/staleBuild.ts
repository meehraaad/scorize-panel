/**
 * A deploy replaces the hashed files in /panel/assets/, so a tab opened before it fails to load
 * the code (or dictionary) of a page it hasn't opened yet. A reload fetches the new build: the
 * error boundaries do it once for the user instead of showing an error that a reload would fix.
 */

/** What browsers say when a lazy module can't be fetched (Chrome, Firefox, Safari, Vite's CSS). */
const CHUNK_FAILED =
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

const KEY = 'scorize.staleBuildReload';
/** A second failure this soon after reloading is not an old build (network, server): show it. */
const RETRY_AFTER = 60_000;

const storage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function isStaleBuildError(error: unknown) {
  return error instanceof Error && CHUNK_FAILED.test(error.message);
}

/** Whether the boundary should reload for this error rather than show it. Pure: call it once. */
export function shouldReloadFor(error: unknown) {
  if (!isStaleBuildError(error)) return false;
  const store = storage();
  if (!store) return false; // Without storage a reload loop couldn't be stopped.
  const last = Number(store.getItem(KEY));
  return !last || Date.now() - last > RETRY_AFTER;
}

export function reloadForNewBuild() {
  storage()?.setItem(KEY, String(Date.now()));
  window.location.reload();
}
