import { keepPreviousData, queryOptions } from '@tanstack/react-query';
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
  /** Where it stands (SVC4); null for a kind without stages yet. Missing from an older Django. */
  stage?: ServiceStage | null;
  /**
   * On the case page: the viewer chooses its owner (a manager, or the lead of its domain,
   * «سرپرست دامنه»). Missing from an older Django: managers only, as before.
   */
  assignable?: boolean;
}

/** One of a kind's stages, as staff named them in Django's admin. */
export interface ServiceStage {
  key: string;
  name: string;
  /** An outcome (visa granted or refused). */
  final: boolean;
}

/** A visa result recorded for the service's case and country (on the old site, as today). */
export interface ServiceVisaResult {
  id: number;
  title: string;
  status:
    | 'getting_appointment'
    | 'pending_appointment'
    | 'pending_result'
    | 'granted'
    | 'refused'
    | 'missed_appointment'
    | 'canceled_appointment';
  /** Localized. */
  embassy: string;
  /** The embassy's country id. */
  embassy_id: number;
  appointment_at: string | null;
  resolved_at: string | null;
  note: string | null;
  /** The appointment's proof file. */
  proof: string | null;
}

export type VisaStatus = ServiceVisaResult['status'];
export const VISA_STATUSES: readonly VisaStatus[] = [
  'getting_appointment',
  'pending_appointment',
  'pending_result',
  'granted',
  'refused',
  'missed_appointment',
  'canceled_appointment',
];

/** What the form sends; an absent field is left as it is (on a change). */
export interface VisaResultInput {
  title: string;
  status: VisaStatus;
  embassy: number;
  /** ISO; null clears it. */
  appointment_at: string | null;
  resolved_at: string | null;
  note: string;
  appointment_proof: File | null;
}

export interface ServiceDetail {
  service: CaseService;
  stages: ServiceStage[];
  /** The viewer may set the stage: the owner, or a manager (not on a closed service). */
  editable: boolean;
  /** Its stage is read from the case's (admission, SVC6): changed there, not here. */
  follows_case?: boolean;
  /** The viewer chooses its owner: a manager, or its domain's lead. Missing from an older Django. */
  assignable?: boolean;
  /** Visa services: the country's results; null for other kinds. */
  visa: ServiceVisaResult[] | null;
  /** The embassies a result can name; null unless the viewer records results (owner or manager). */
  countries?: { id: number; name: string }[] | null;
}

export interface MyService extends CaseService {
  case: number;
  case_name: string;
  /** The customer's messages in this service's conversation nobody has seen. */
  unread: number;
  last_message_at: string | null;
}

export interface MyServices {
  count: number;
  /** Unread first, then the latest conversation; at most 200. */
  results: MyService[];
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

export const serviceQuery = (caseId: number, service: number) =>
  queryOptions({
    queryKey: [...SUPERVISOR_KEY, 'case', caseId, 'service', service],
    queryFn: ({ signal }) =>
      api<ServiceDetail>(`${SUPERVISOR_API}/cases/${String(caseId)}/services/${String(service)}/`, {
        signal,
      }),
  });

export const myServicesQuery = queryOptions({
  queryKey: [...SUPERVISOR_KEY, 'my-services'],
  queryFn: ({ signal }) => api<MyServices>(`${SUPERVISOR_API}/services/mine/`, { signal }),
});

export function useSetServiceStage(caseId: number) {
  return useSupervisorMutation(({ service, stage }: { service: number; stage: string }) =>
    api(`${SUPERVISOR_API}/cases/${String(caseId)}/services/${String(service)}/stage/`, {
      method: 'POST',
      body: { stage },
    }),
  );
}

export function useSetServiceOwner(caseId: number) {
  return useSupervisorMutation(({ service, owner }: { service: number; owner: number }) =>
    api(ownerUrl(caseId, service), { method: 'POST', body: { owner } }),
  );
}

/** Kinds whose stage follows the case's (Django `client_services.stages.FOLLOW_CASE`). */
export const FOLLOWS_CASE: readonly string[] = ['admission'];

export const SERVICE_REPORT_PERIODS = ['week', 'month', 'quarter'] as const;
export type ServiceReportPeriod = (typeof SERVICE_REPORT_PERIODS)[number];

export interface ResponseNumbers {
  /** Open and paused services. */
  services: number;
  /** Conversations whose last message is the customer's. */
  waiting: number;
  /** Customer messages answered in the period. */
  answered: number;
  median_minutes: number | null;
  /** Answered after more than 24 hours. */
  slow: number;
}

export interface OwnerNumbers extends ResponseNumbers {
  /** null: the services nobody owns. */
  id: number | null;
  name: string | null;
  team: string | null;
}

export interface ServicesReport {
  days: number;
  /** Most waiting first. */
  owners: OwnerNumbers[];
  teams: (ResponseNumbers & { team: string | null })[];
}

/** How the services are answered (SVC6): managers see all, a supervisor their scopes and own. */
export const servicesReportQuery = (period: ServiceReportPeriod) =>
  queryOptions({
    queryKey: [...SUPERVISOR_KEY, 'services-report', period],
    queryFn: ({ signal }) =>
      api<ServicesReport>(`${SUPERVISOR_API}/services/report/?period=${period}`, { signal }),
    placeholderData: keepPreviousData,
  });

/** Records a visa result for the service's case and country, or changes one (`id`). */
export function useSaveVisaResult(caseId: number, service: number) {
  return useSupervisorMutation(({ id, input }: { id: number | null; input: VisaResultInput }) => {
    const body = new FormData();
    body.append('title', input.title);
    body.append('status', input.status);
    body.append('embassy', String(input.embassy));
    body.append('appointment_at', input.appointment_at ?? '');
    body.append('resolved_at', input.resolved_at ?? '');
    body.append('note', input.note);
    if (input.appointment_proof) body.append('appointment_proof', input.appointment_proof);
    const base = `${SUPERVISOR_API}/cases/${String(caseId)}/services/${String(service)}/visa/`;
    return api<ServiceVisaResult>(id === null ? base : `${base}${String(id)}/`, {
      method: id === null ? 'POST' : 'PATCH',
      body,
    });
  });
}
