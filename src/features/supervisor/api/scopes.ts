import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useSupervisorMutation } from './case';
import { SUPERVISOR_API, SUPERVISOR_KEY } from './common';

/**
 * Supervisors' scopes (backend-changes.md SVC5, Django docs/client-services.md phase 5), for
 * managers: who oversees which kind of service (null: every kind) in which country (null: every
 * country), and where the scopes and today's rule (supervised cases, and every case of one's
 * countries) disagree. Django applies the scopes only once `applied`.
 */

export interface ScopeKind {
  key: string;
  name: string;
}

export interface ScopeCountry {
  id: number;
  name: string;
}

export interface Scope {
  id: number;
  /** SupportStaff id. */
  staff: number;
  kind: ScopeKind | null;
  country: ScopeCountry | null;
  /**
   * «سرپرست دامنه»: also chooses the owners of this domain's services and gets the task about
   * those nobody owns. Applies at once, unlike plain scopes.
   */
  leads: boolean;
}

export interface ScopePerson {
  id: number;
  name: string;
  /** Their countries under today's rule. */
  countries: string[];
}

export interface ScopeDifference {
  staff: number;
  staff_name: string;
  case: number;
  case_name: string;
  /** old_only: today's rule shows the case and the scopes wouldn't; new_only: the reverse. */
  side: 'old_only' | 'new_only';
}

export interface ScopesData {
  applied: boolean;
  people: ScopePerson[];
  scopes: Scope[];
  kinds: ScopeKind[];
  countries: ScopeCountry[];
  differences: { count: number; results: ScopeDifference[] };
}

export interface NewScope {
  staff: number;
  kind: string | null;
  country: number | null;
  leads: boolean;
}

export const scopesQuery = queryOptions({
  queryKey: [...SUPERVISOR_KEY, 'scopes'],
  queryFn: ({ signal }) => api<ScopesData>(`${SUPERVISOR_API}/scopes/`, { signal }),
});

export const useAddScope = () =>
  useSupervisorMutation((scope: NewScope) =>
    api<Scope>(`${SUPERVISOR_API}/scopes/`, { method: 'POST', body: scope }),
  );

export const useSetScopeLead = () =>
  useSupervisorMutation(({ id, leads }: { id: number; leads: boolean }) =>
    api<Scope>(`${SUPERVISOR_API}/scopes/${String(id)}/`, { method: 'PATCH', body: { leads } }),
  );

export const useRemoveScope = () =>
  useSupervisorMutation((id: number) =>
    api(`${SUPERVISOR_API}/scopes/${String(id)}/`, { method: 'DELETE' }),
  );

export const useScopesFromCountries = () =>
  useSupervisorMutation(() =>
    api<{ made: number }>(`${SUPERVISOR_API}/scopes/from-countries/`, { method: 'POST' }),
  );
