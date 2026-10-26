import { useEffect } from 'react';

/**
 * One page of a server list: `?page=` (from 1) answers the total, the page size and the rows. Every
 * paged list of the panel has this shape (leads, cases, receipts, tasks…), so `Pager` reads it the
 * same way everywhere.
 */
export interface Page<T> {
  count: number;
  page_size: number;
  results: T[];
}

/** How many pages the list has (at least one, for "page 1 of 1"). */
export const pagesOf = (page: Pick<Page<unknown>, 'count' | 'page_size'> | undefined) =>
  page ? Math.max(1, Math.ceil(page.count / Math.max(1, page.page_size))) : 1;

/**
 * Steps back when the list shrank under the current page (the last row of the last page was
 * confirmed, claimed, done…): the server answers an empty page there.
 */
export function useClampPage(
  data: Pick<Page<unknown>, 'count' | 'page_size'> | undefined,
  page: number,
  setPage: (page: number) => void,
) {
  const pages = pagesOf(data);
  useEffect(() => {
    if (data && page > pages) setPage(pages);
  }, [data, page, pages, setPage]);
}

/**
 * Shorter pages than the server's, cut out of its pages: page `page` of `size` rows is rows
 * `offset…offset+size` of server page `serverPage`. A short page never spans two server pages
 * (the last one of each server page holds what is left), so it needs one request.
 */
export function slicePage(page: number, size: number, serverSize: number) {
  const perServer = Math.max(1, Math.ceil(serverSize / size));
  return {
    serverPage: Math.floor((page - 1) / perServer) + 1,
    offset: ((page - 1) % perServer) * size,
  };
}

/** How many short pages `slicePage` makes of `count` rows (at least one). */
export function slicedPages(count: number, size: number, serverSize: number) {
  const perServer = Math.max(1, Math.ceil(serverSize / size));
  const full = Math.floor(count / Math.max(1, serverSize));
  return Math.max(1, full * perServer + Math.ceil((count - full * serverSize) / size));
}
