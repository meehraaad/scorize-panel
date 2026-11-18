import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SUPERVISOR_API, SUPERVISOR_KEY } from './common';
import { useSupervisorMutation } from './case';

/**
 * A case's services (docs/backend-changes.md SVC2, Django docs/client-services.md): what the
 * customer bought, one unit of work at a time ("admission · Germany", "visa · Germany"), each with
 * one owner. Everyone on the case reads them on the case page (`CaseData.services`); managers
 * (`can_assign_supervisor`) choose or change an owner, and see those nobody owns on the new-cases
 * page (`HandoffsData.unassigned_services`). Both are null while Django has them switched off.
 */

export interface ServiceOwner {
  id: number;
  name: string;
}

export interface CaseService {
  id: number;
  /** `ServiceType.key`: admission, visa, … (more kinds come from Django's admin). */
  kind: string;
  /** The kind's name as staff wrote it. */
  name: string;
  /** Localized; null for a kind that isn't per country. */
  country: string | null;
  /** paused: the contract is on hold. */
  status: 'open' | 'paused' | 'closed';
  /** null: waiting for a manager to choose. */
  owner: ServiceOwner | null;
}

export interface ServiceCandidate {
  id: number;
  name: string;
  /** Open services they own. */
  services: number;
  /** TeamType name in lower case (executive, visa, …). */
  team: string | null;
  countries: string[];
}

export interface ServiceOwners {
  service: CaseService;
  results: ServiceCandidate[];
  /** The least busy person of the kind's team who covers the country. */
  suggested: number | null;
}

export interface UnassignedService extends CaseService {
  case: number;
  case_name: string;
}

export interface UnassignedServices {
  count: number;
  /** The oldest 100. */
  results: UnassignedService[];
}

/** "Visa · Germany", or the kind alone when it isn't per country. */
export function serviceTitle(service: Pick<CaseService, 'name' | 'country'>) {
  return service.country ? `${service.name} · ${service.country}` : service.name;
}

const ownerUrl = (caseId: number, service: number) =>
  `${SUPERVISOR_API}/cases/${String(caseId)}/services/${String(service)}/owner/`;

export const serviceOwnersQuery = (caseId: number, service: number) =>
  queryOptions({
    queryKey: [...SUPERVISOR_KEY, 'case', caseId, 'service-owners', service],
    queryFn: ({ signal }) => api<ServiceOwners>(ownerUrl(caseId, service), { signal }),
  });

export function useSetServiceOwner(caseId: number) {
  return useSupervisorMutation(({ service, owner }: { service: number; owner: number }) =>
    api(ownerUrl(caseId, service), { method: 'POST', body: { owner } }),
  );
}
