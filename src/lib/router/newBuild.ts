/**
 * A tab, and above all the panel added to a phone's home screen (no reload button there), can run
 * the code of an old build for days: new features never show and changed APIs break it until the
 * site's data is cleared. This checks the server's index.html for a newer build whenever the tab
 * comes back to the front (and every 10 minutes while it is), then loads it:
 * - right away when the tab comes back to the front: the seller is just returning to it;
 * - otherwise at the next page change, so nobody's typing is cut off.
 * Unsaved contact forms survive the reload (they are kept in sessionStorage).
 */

const CHECK_EVERY = 10 * 60_000;
const RELOADED_KEY = 'scorize.newBuildReload';
/** Never reload twice in this long: a server answering two builds at once must not loop the tab. */
const RELOAD_GAP = 60_000;

function reload() {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY));
    if (last && Date.now() - last < RELOAD_GAP) return;
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  } catch {
    return; // Without storage a loop couldn't be stopped.
  }
  window.location.reload();
}
const ENTRY = /<script[^>]*type="module"[^>]*src="([^"]+)"/i;

/** The address of the build's entry script in this page or in `html`, absolute; null in dev. */
export function entryOf(html: string, base: string) {
  const src = ENTRY.exec(html)?.[1];
  return src ? new URL(src, base).href : null;
}

function currentEntry() {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
  return script?.src ?? null;
}

async function serverHasNewBuild(current: string) {
  try {
    const response = await fetch(import.meta.env.BASE_URL, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) return false;
    const next = entryOf(await response.text(), window.location.href);
    return next !== null && next !== current;
  } catch {
    return false; // Offline or a hiccup: try again later.
  }
}

interface Navigates {
  subscribe: (listener: (state: { location: { key: string } }) => void) => () => void;
}

/** Start watching; returns the cleanup. Does nothing in dev (no hashed build to compare). */
export function watchForNewBuild(router: Navigates) {
  const current = currentEntry();
  if (import.meta.env.DEV || !current || !current.includes('/assets/')) return () => undefined;

  let stale = false;
  let checking = false;
  const check = async (reloadNow: boolean) => {
    if (checking) return;
    checking = true;
    if (!stale) stale = await serverHasNewBuild(current);
    checking = false;
    if (stale && reloadNow) reload();
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') void check(true);
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onVisible); // Back from the browser's page cache (iOS).
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void check(false);
  }, CHECK_EVERY);

  let lastKey: string | null = null;
  const unsubscribe = router.subscribe(({ location }) => {
    if (lastKey !== null && location.key !== lastKey && stale) reload();
    lastKey = location.key;
  });

  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onVisible);
    window.clearInterval(timer);
    unsubscribe();
  };
}
