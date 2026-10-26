import { queryOptions } from '@tanstack/react-query';
import type { Page } from '@/lib/api/page';
import { api } from '@/lib/api/client';
import type { Degree } from '@/lib/applicant/approval';
import { SUPERVISOR_API, type CaseStage, type DocCount, SUPERVISOR_KEY } from './common';

/** Why an upcoming deadline needs attention (or that it's done). */
export type BoardStatus = 'fee_unpaid' | 'ready' | 'waiting_approval' | 'sop_missing' | 'submitted';

/** An application whose deadline falls in the next 14 days. */
export interface BoardItem {
  application: number;
  applicant: { id: number; name: string };
  university: string;
  program: string;
  deadline: string;
  status: BoardStatus;
}

/** A case with something for the supervisor to do now. */
export interface WaitingCase {
  id: number;
  name: string;
  file_number: number;
  degree: Degree | null;
  countries: string[];
  /** What to do, written by the server ("Pay the Stanford application fee"). */
  todo: string;
  /** Overdue, or a deadline within 7 days. */
  urgent: boolean;
  next_deadline: string | null;
  docs: DocCount;
}

export interface TodayData {
  board: BoardItem[];
  waiting: WaitingCase[];
  /** Cases by stage, for the links under the list. */
  counts: Record<CaseStage, number>;
}

export const todayQuery = queryOptions({
  queryKey: [...SUPERVISOR_KEY, 'today'],
  queryFn: ({ signal }) => api<TodayData>(`${SUPERVISOR_API}/today/`, { signal }),
  refetchInterval: 5 * 60_000,
});

export const todayBoardQuery = (page: number) =>
  queryOptions({
    queryKey: [...SUPERVISOR_KEY, 'today', 'board', page],
    queryFn: ({ signal }) =>
      api<Page<BoardItem>>(`${SUPERVISOR_API}/today/board/?page=${String(page)}`, { signal }),
    refetchInterval: 5 * 60_000,
  });
export const todayWaitingQuery = (page: number) =>
  queryOptions({
    queryKey: [...SUPERVISOR_KEY, 'today', 'waiting', page],
    queryFn: ({ signal }) =>
      api<Page<WaitingCase>>(`${SUPERVISOR_API}/today/waiting/?page=${String(page)}`, { signal }),
    refetchInterval: 5 * 60_000,
  });
export const todayCountsQuery = queryOptions({
  queryKey: [...SUPERVISOR_KEY, 'today', 'counts'],
  queryFn: ({ signal }) => api<TodayData['counts']>(`${SUPERVISOR_API}/today/counts/`, { signal }),
  refetchInterval: 5 * 60_000,
});
