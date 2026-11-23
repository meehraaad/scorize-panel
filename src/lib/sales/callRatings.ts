import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from './api';

export type RatingScope = 'mine' | 'team';

export interface RatingStats {
  count: number;
  average: number | null;
}

export interface QueueRating extends RatingStats {
  queue: number;
}

export interface AgentRating extends QueueRating {
  staff_id: number | null;
  extension: number | null;
  agent: string | null;
}

interface RatingSummary {
  total: RatingStats;
  queues: QueueRating[];
  agents: AgentRating[];
}

export const callRatingsQuery = (scope: RatingScope) =>
  queryOptions({
    queryKey: [...SALES_KEY, 'call-ratings', scope],
    queryFn: ({ signal }) => api<RatingSummary>(`${SALES_API}/calls/ratings/${scope}/`, { signal }),
    staleTime: 30_000,
  });
