import type { RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from './router';

/** Paths of lazy pages that don't name a skeleton (theirs or a parent's), as `/a/b`. */
function unnamed(list: RouteObject[], parent = '', named = false): string[] {
  return list.flatMap((route) => {
    const path = route.index ? parent || '/' : [parent, route.path].filter(Boolean).join('/');
    const has =
      named ||
      Boolean(route.handle && typeof route.handle === 'object' && 'skeleton' in route.handle);
    const own = route.lazy && !route.children && !has ? [path || '/'] : [];
    return [...own, ...unnamed(route.children ?? [], path, has)];
  });
}

// Panel pages (everything inside PanelLayout) show their own shape while loading, never a spinner
// (docs/performance.md, "Loading states"). Login, /start, /choose and the dev gallery are outside.
const OUTSIDE = new Set(['login', 'start', 'choose', 'dev/components']);
const isOutside = (route: RouteObject): boolean =>
  OUTSIDE.has(route.path ?? '') || Boolean(route.children?.some(isOutside));

describe('loading states', () => {
  it('every panel page names its skeleton (lazyPage(…, { skeleton }))', () => {
    expect(unnamed(routes.filter((route) => !isOutside(route)))).toEqual([]);
  });
});
