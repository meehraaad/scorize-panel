import { useEffect } from 'react';
import { matchRoutes, useHref, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { whenIdle } from '@/lib/whenIdle';

/*
 * Preload on intent (docs/performance.md): when a pointer rests on an in-app link, or it is
 * focused or touched, the target page's code and data start loading before the click, so the
 * click usually renders from cache. The panel's nav pages also fetch their code once the browser
 * is idle. Loaders here only start queries (lazyPage), so running them early is safe: React Query
 * de-duplicates, and fresh data is not fetched again.
 */

let tree: RouteObject[] = [];
/** The app's route tree (router.tsx registers it once). */
export function setPreloadRoutes(routes: RouteObject[]) {
  tree = routes;
}

// Hovering back and forth over one link starts it once.
const recent = new Map<string, number>();
const REPEAT_MS = 10_000;
const HOVER_MS = 80;

/** Start a router path's code (and, with `data`, its route data). `path` has no basename. */
export function preloadPath(path: string, { data = true, search = '' } = {}) {
  const key = `${data ? 'data' : 'code'} ${path}${search}`;
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < REPEAT_MS) return;
  recent.set(key, now);

  const request = new Request(new URL(path + search, window.location.origin));
  for (const { route, params } of matchRoutes(tree, path) ?? []) {
    if (typeof route.lazy === 'function') route.lazy().catch(() => undefined);
    if (data && typeof route.loader === 'function') {
      // A loader's redirect or failure means nothing here: the real navigation handles it.
      Promise.resolve(
        route.loader({ request, params, context: undefined } as unknown as LoaderFunctionArgs),
      ).catch(() => undefined);
    }
  }
}

/** The router path of an in-app link, or null (another site, a new tab, a download). */
function routerPath(link: HTMLAnchorElement, base: string) {
  if (link.origin !== window.location.origin || link.target === '_blank' || link.download)
    return null;
  if (!link.pathname.startsWith(base)) return null;
  const path = `/${link.pathname.slice(base.length)}`;
  const here = window.location;
  return link.pathname === here.pathname && link.search === here.search ? null : path;
}

const linkOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;

/** Listens for intent on every in-app link of the page. Mount once (the panel frame). */
export function useIntentPreload() {
  // The router's basename with its slash: '/panel/' in the app, '/' in tests.
  const base = useHref('/');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = (link: HTMLAnchorElement | null) => {
      const path = link && routerPath(link, base);
      if (link && path) preloadPath(path, { search: link.search });
    };
    const hover = (event: PointerEvent) => {
      clearTimeout(timer);
      if (event.pointerType !== 'mouse') return;
      const link = linkOf(event.target);
      if (link) timer = setTimeout(() => start(link), HOVER_MS);
    };
    const leave = () => clearTimeout(timer);
    const now = (event: Event) => start(linkOf(event.target));

    document.addEventListener('pointerover', hover);
    document.addEventListener('pointerout', leave);
    document.addEventListener('focusin', now);
    document.addEventListener('touchstart', now, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', hover);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('focusin', now);
      document.removeEventListener('touchstart', now);
    };
  }, [base]);
}

/** Once the browser is idle, fetch the code (not the data) of these router paths. */
export function useIdlePreload(paths: readonly string[]) {
  const key = paths.join(' ');
  useEffect(() => {
    return whenIdle(() => {
      for (const path of key.split(' ')) preloadPath(path, { data: false });
    });
  }, [key]);
}
