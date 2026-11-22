import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SUPERVISOR_API, SUPERVISOR_KEY } from './common';

/** One supervisor's or visa expert's load, over their open cases (GET manager/team/). */
export interface TeamPerson {
  id: number;
  name: string;
  team: 'executive' | 'visa';
  countries: string[];
  cases: number;
  /** Cases with a customer message nobody on the team has answered yet. */
  waiting: number;
  waiting_since: string | null;
  /** Open services they own; null while client services are off. */
  services: number | null;
  tasks: number;
  overdue: number;
}

export interface TeamData {
  people: TeamPerson[];
  totals: {
    cases: number;
    waiting: number;
    no_supervisor: number;
    unowned_services: number | null;
  };
}

/** The manager's team page (`can_assign_supervisor`); also the supervisor filter's people. */
export const managerTeamQuery = queryOptions({
  queryKey: [...SUPERVISOR_KEY, 'manager', 'team'],
  queryFn: ({ signal }) => api<TeamData>(`${SUPERVISOR_API}/manager/team/`, { signal }),
});
