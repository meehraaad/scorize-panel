import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { API_BASE, api } from '@/lib/api/client';
import type { Degree } from '@/lib/applicant/approval';
import {
  SUPERVISOR_API,
  type CaseStage,
  type DocCount,
  SUPERVISOR_KEY,
  type WritingState,
} from './common';

export type StageFilter = 'all' | CaseStage;
export type BotFilter = 'all' | 'on' | 'off';

export interface CaseRow {
  id: number;
  name: string;
  file_number: number;
  degree: Degree | null;
  countries: string[];
  stage: CaseStage;
  /** The contract's name, localized ("Full application", "Self-apply"). */
  contract: string;
  cv: WritingState | null;
  sop: WritingState | null;
  bot: boolean;
  docs: DocCount;
  last_activity: string;
}

export interface CasesQuery {
  search: string;
  stage: StageFilter;
  bot: BotFilter;
  page: number;
}

export interface CasesPage {
  count: number;
  page_size: number;
  counts: Record<StageFilter, number>;
  results: CaseRow[];
}

export const casesQuery = (query: CasesQuery) =>
  queryOptions({
    queryKey: [...SUPERVISOR_KEY, 'cases', query],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ page: String(query.page) });
      if (query.search.trim()) params.set('search', query.search.trim());
      if (query.stage !== 'all') params.set('stage', query.stage);
      if (query.bot !== 'all') params.set('bot', query.bot);
      return api<CasesPage>(`${SUPERVISOR_API}/cases/?${params.toString()}`, { signal });
    },
    placeholderData: keepPreviousData,
  });

/** The applications of the chosen cases as a spreadsheet (CSV). A plain download link. */
export const exportHref = (ids: readonly number[]) =>
  `${API_BASE}${SUPERVISOR_API}/cases/export/?ids=${ids.join(',')}`;
