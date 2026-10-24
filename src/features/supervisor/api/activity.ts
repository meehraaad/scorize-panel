import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { type CaseActivity, caseKey } from './case';
import { SUPERVISOR_API } from './common';

export interface ActivityPage {
  count: number;
  page_size: number;
  results: CaseActivity[];
}

export const activityQuery = (id: number, page: number) =>
  queryOptions({
    queryKey: [...caseKey(id), 'activity', page],
    queryFn: ({ signal }) =>
      api<ActivityPage>(`${SUPERVISOR_API}/cases/${String(id)}/activity/?page=${String(page)}`, {
        signal,
      }),
    placeholderData: keepPreviousData,
  });
