import type {
  InfiniteQueryExecuteOptions,
  QueryExecuteOptions,
  QueryKey,
} from '@tanstack/react-query';
import type { ComponentType } from 'react';
import { useMatches, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { queryClient } from '@/lib/api/queryClient';
import i18n from '@/lib/i18n';
import type { Namespace } from '@/lib/i18n/config';
import type { SkeletonKind } from '@/components/ui/Skeleton';

/**
 * What a `queryOptions()` / `infiniteQueryOptions()` factory returns. Only the parts this file
 * reads are typed: the factories give each query its own data and key types, which a list of
 * different queries can't keep.
 */
export interface PageQuery {
  queryKey: QueryKey;
  initialPageParam?: unknown;
}

/**
 * Every query a page (or layout) reads on its first render, from the URL alone: route params,
 * search params, and the page's starting state (page 1, default tab and filters). `false` or
 * `null` skips one, e.g. for a bad id.
 */
export type PageData = (args: LoaderFunctionArgs) => readonly (PageQuery | false | null)[];

/** Start these queries now; queries already fresh in the cache are not fetched again. */
export function prefetchQueries(queries: readonly (PageQuery | false | null)[]) {
  for (const query of queries) {
    if (!query) continue;
    // A failure is not handled here: the page reads the query and shows the error.
    const started =
      query.initialPageParam !== undefined
        ? queryClient.infiniteQuery(query as InfiniteQueryExecuteOptions)
        : queryClient.query(query as QueryExecuteOptions);
    started.catch(() => undefined);
  }
}

export interface PageOptions {
  /** Every query the page reads on its first render (see `PageData`). */
  data?: PageData;
  /**
   * The page's shape while it loads (`PageSkeleton`). Every page directly under a panel names one;
   * tabs inside a page with its own frame (customer, case file) use that frame's.
   */
  skeleton?: SkeletonKind;
  /**
   * Only some users may open the page: answers a redirect for the others, before the page's data
   * starts. (A route's own `loader` beside `...lazyPage()` would be replaced by the data loader.)
   */
  guard?: () => Promise<Response | null>;
}

/** What a route's `handle` holds for the panel frame. */
export interface PageHandle {
  skeleton?: SkeletonKind;
}

const skeletonOf = (handle: unknown): SkeletonKind | undefined =>
  handle && typeof handle === 'object' && 'skeleton' in handle
    ? (handle as PageHandle).skeleton
    : undefined;

/** The current page's skeleton: the deepest matched route that names one. */
export function usePageSkeleton(): SkeletonKind {
  return (
    useMatches()
      .map((match) => skeletonOf(match.handle))
      .findLast((kind) => kind !== undefined) ?? 'list'
  );
}

/**
 * A lazily loaded page: each page is its own chunk, so a phone only downloads the code for the
 * page it opens. Its code, its dictionary namespaces and its data (`data`) all load at once, as
 * soon as the route matches, so opening a page costs one round trip, never a chain of them
 * (docs/performance.md). `pageData.test.tsx` fails when a page fetches something its route did not.
 */
export function lazyPage(
  load: () => Promise<{ default: ComponentType }>,
  namespaces: Namespace[] = [],
  { data, skeleton, guard }: PageOptions = {},
): Pick<RouteObject, 'lazy' | 'loader' | 'handle'> {
  const start = (args: LoaderFunctionArgs) => {
    if (data) prefetchQueries(data(args));
    return null;
  };
  return {
    ...(guard
      ? { loader: async (args: LoaderFunctionArgs) => (await guard()) ?? start(args) }
      : data && { loader: start }),
    ...(skeleton && { handle: { skeleton } satisfies PageHandle }),
    lazy: async () => {
      const [module] = await Promise.all([load(), i18n.loadNamespaces(namespaces)]);
      return { Component: module.default };
    },
  };
}

/** A route's positive whole-number id param (`/customers/:id`), or null: the page says it's wrong. */
export function idParam(value: string | undefined) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
