import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  HR_API,
  HR_KEY,
  type Brief,
  type HrEventKind,
  type Named,
  type StaffState,
  type TaskNumbers,
  type Team,
} from '../api';

/**
 * Teams and their people from their own tasks (lang `api/hr/v1/teams.py`). A team's numbers are
 * only its members' tasks summed (`SupportStaff.team`); attendance is left out (most teams work
 * remotely).
 */
export type TeamState = 'good' | 'attention' | 'behind';

export interface TeamCard {
  team: Team;
  /** Who most of the team reports to in the org chart. */
  manager: Named | null;
  people: Brief[];
  tasks: TaskNumbers;
  state: TeamState;
  counts: Record<'trial' | 'joining' | 'leaving' | 'ending', number>;
}

export interface TeamsData {
  teams: TeamCard[];
  /** Active people whose file has no team. */
  no_team: Brief[];
}

export interface TeamMember extends Brief {
  position: string | null;
  tasks: TaskNumbers;
  state: StaffState;
  /** Their contract's last day when within 30 days. */
  contract_end: string | null;
  trial: boolean;
}

export interface TeamDetail {
  team: Team;
  manager: Named | null;
  tasks: TaskNumbers;
  state: TeamState;
  /** This month and the three before, newest first; `first`: the month's first day. */
  months: { year: number; month: number; first: string; on_time: number | null }[];
  /** Most overdue first. */
  people: TeamMember[];
  /** The oldest five, and how many there are. */
  overdue_tasks: { id: number; text: string; days: number; owner: Named | null }[];
  overdue_count: number;
  coming: { kind: HrEventKind; day: string; staff: Named }[];
}

export const teamsQuery = queryOptions({
  queryKey: [...HR_KEY, 'teams'],
  queryFn: ({ signal }) => api<TeamsData>(`${HR_API}/teams/`, { signal }),
});

export const teamQuery = (team: string) =>
  queryOptions({
    queryKey: [...HR_KEY, 'teams', team],
    queryFn: ({ signal }) =>
      api<TeamDetail>(`${HR_API}/teams/${encodeURIComponent(team)}/`, { signal }),
  });

export const STATE_TONE = { good: 'good', attention: 'warn', behind: 'danger' } as const;
