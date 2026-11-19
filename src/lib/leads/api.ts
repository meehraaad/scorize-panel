import { queryOptions } from '@tanstack/react-query';
import { API_BASE, api } from '@/lib/api/client';

/**
 * Lead sources and CSV lead uploads, shared by the sales manager and the marketing panel.
 * Django: `api/marketing/v1/sources.py` (the marketing team keeps its own sources; the system's
 * can't change) and `api/sales/v1/imports.py` (the upload; the marketing panel's copy is
 * `api/marketing/v1/leads/import/`, whose leads always go to the sales queue).
 */

/**
 * A source: one of the system's (`failed_purchase`, `call_request`, …; named by the panel's
 * dictionary) or one the marketing team added (`c<id>`, named by `name`).
 */
export interface LeadSourceRow {
  /** null for a system source. */
  id: number | null;
  /** What a lead's `source` says. */
  code: string;
  name: string;
  system: boolean;
  /** Archived team sources stay on their leads but can't be picked. */
  active: boolean;
  /** Leads with this source (the marketing list only). */
  leads?: number;
}

/** The system's sources (Django `user_profile.leads.SYSTEM_SOURCES`), in the order lists show them. */
export const SYSTEM_SOURCES = [
  'failed_purchase',
  'call_request',
  'chance_estimate',
  'document_upload',
  'campaign',
  'consultation',
  'manual',
] as const;
export type SystemSource = (typeof SYSTEM_SOURCES)[number];

export const isSystemSource = (code: string): code is SystemSource =>
  (SYSTEM_SOURCES as readonly string[]).includes(code);

/** The system sources an upload may name; the rest of its choices are the team's active ones. */
export const UPLOAD_SYSTEM_SOURCES = [
  'campaign',
  'manual',
] as const satisfies readonly SystemSource[];

/** Every source, for the sales panel's filters and names (Django `api/sales/v1/sources/`). */
export const salesSourcesQuery = queryOptions({
  queryKey: ['sales', 'sources'],
  queryFn: () => api<LeadSourceRow[]>('/sales/v1/sources/'),
  staleTime: 5 * 60_000,
});

/** What a file's row would do. */
export type LeadImportChange = 'new' | 'existing' | 'skip';

/** Why a row is left out. */
export type LeadImportProblem = 'missing_column' | 'bad_phone' | 'duplicate' | 'open_lead';

export interface LeadImportRow {
  /** Line in the file (the header is line 1). */
  line: number;
  phone: string;
  name: string;
  /** The known customer with this number; null for a new one. */
  customer: number | null;
  change: LeadImportChange;
  problem: LeadImportProblem | null;
}

export interface LeadImportPreview {
  /** Hands the checked file to the apply step (the server keeps it 15 minutes). */
  token: string;
  file: { name: string; size: number; rows: number };
  counts: Record<LeadImportChange, number>;
  rows: LeadImportRow[];
}

export interface LeadImportOptions {
  token: string;
  /** `campaign`, `manual`, or an active team source's `c<id>`. */
  source: string;
  /** Added to every lead's description, after the row's own note. */
  note: string;
  /** null: the assignment queue (always, from the marketing panel). */
  seller: number | null;
  /** The welcome SMS for new customers. */
  notify: boolean;
}

export interface LeadImportResult {
  created: number;
  new_customers: number;
}

/** One upload endpoint: `<base>/preview/`, `<base>/` and `<base>/sample/`. */
export const sampleHref = (base: string) => `${API_BASE}${base}/sample/`;

export function previewLeadImport(base: string, file: File) {
  const body = new FormData();
  body.append('file', file);
  return api<LeadImportPreview>(`${base}/preview/`, { method: 'POST', body });
}

export function applyLeadImport(base: string, options: LeadImportOptions) {
  return api<LeadImportResult>(`${base}/`, { method: 'POST', body: options });
}
