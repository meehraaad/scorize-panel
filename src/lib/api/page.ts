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
