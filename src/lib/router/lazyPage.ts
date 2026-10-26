import type {
  InfiniteQueryExecuteOptions,
  QueryExecuteOptions,
  QueryKey,
} from '@tanstack/react-query';
import type { ComponentType } from 'react';
import type { LoaderFunctionArgs, RouteObject } from 'react-router';
import { queryClient } from '@/lib/api/queryClient';
import i18n from '@/lib/i18n';
import type { Namespace } from '@/lib/i18n/config';

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

/**
 * A lazily loaded page: each page is its own chunk, so a phone only downloads the code for the
 * page it opens. Its code, its dictionary namespaces and its data (`data`) all load at once, as
 * soon as the route matches, so opening a page costs one round trip, never a chain of them
 * (docs/performance.md). `pageData.test.tsx` fails when a page fetches something its route did not.
 */
export function lazyPage(
  load: () => Promise<{ default: ComponentType }>,
  namespaces: Namespace[] = [],
  data?: PageData,
): Pick<RouteObject, 'lazy' | 'loader'> {
  return {
    ...(data && {
      loader: (args: LoaderFunctionArgs) => {
        prefetchQueries(data(args));
        return null;
      },
    }),
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
