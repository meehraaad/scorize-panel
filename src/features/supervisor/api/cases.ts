import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { API_BASE, api } from '@/lib/api/client';
import type { Degree } from '@/lib/applicant/approval';
import {
  CASE_STAGES,
  SUPERVISOR_API,
  type CaseStage,
  type DocCount,
  SUPERVISOR_KEY,
  type WritingState,
} from './common';

export type StageFilter = 'all' | CaseStage;
export type BotFilter = 'all' | 'on' | 'off';

export const STAGE_FILTERS: readonly StageFilter[] = ['all', ...CASE_STAGES];

/**
 * The list as the page first shows it: the URL's stage tab and bot filter (reports link to
 * "bots that are stopped"), no search, page 1. The route prefetches it.
 */
export function firstCasesQuery(params: URLSearchParams, team = false): CasesQuery {
  const stage = params.get('stage');
  const bot = params.get('bot');
  return {
    stage: STAGE_FILTERS.find((value) => value === stage) ?? 'all',
    bot: bot === 'on' || bot === 'off' ? bot : 'all',
    search: '',
    page: 1,
    // The manager's list of every case; the team page links to one person's (`?supervisor=`).
    ...(team && { team: { supervisor: supervisorFilter(params.get('supervisor')) } }),
  };
}

/** The manager's supervisor filter: everyone, cases nobody supervises, or one person's id. */
export type SupervisorFilter = 'all' | 'none' | `${number}`;

const supervisorFilter = (value: string | null): SupervisorFilter =>
  value === 'none' ? 'none' : value && /^\d+$/.test(value) ? (value as `${number}`) : 'all';

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
  supervisors: { id: number; name: string }[];
}

export interface CasesQuery {
  search: string;
  stage: StageFilter;
  bot: BotFilter;
  page: number;
  /** Managers: every case (`scope=all`), optionally one supervisor's. */
  team?: { supervisor: SupervisorFilter };
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
      if (query.team) {
        params.set('scope', 'all');
        if (query.team.supervisor !== 'all') params.set('supervisor', query.team.supervisor);
      }
      return api<CasesPage>(`${SUPERVISOR_API}/cases/?${params.toString()}`, { signal });
    },
    placeholderData: keepPreviousData,
  });

/** The applications of the chosen cases as a spreadsheet (CSV). A plain download link. */
export const exportHref = (ids: readonly number[]) =>
  `${API_BASE}${SUPERVISOR_API}/cases/export/?ids=${ids.join(',')}`;
