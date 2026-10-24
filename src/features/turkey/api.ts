import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { uploadFile, type UploadMessages } from '@/lib/upload';

/**
 * The free Turkey application (canvas V7 section 3): the applicant answers a few questions, uploads
 * the documents for their degree, the team reviews them, and the applicant signs a pledge with an
 * SMS code. Signing starts the case (a free `turkey` contract). Shapes: docs/backend-changes.md
 * H30–H35.
 */

/** Where the request is. `done`: signed; the case has started. */
export const TURKEY_STEPS = ['start', 'docs', 'review', 'sign', 'done'] as const;
export type TurkeyStep = (typeof TURKEY_STEPS)[number];

/** Degrees the programme covers (apply.models.Degree). */
export const TURKEY_DEGREES = [1, 2, 3] as const;
export type TurkeyDegree = (typeof TURKEY_DEGREES)[number];

/**
 * - `missing`: nothing uploaded yet (or removed)
 * - `uploaded`: uploaded, not sent for review yet
 * - `review`: with the team
 * - `approved`, `rejected` (with the team's `note`)
 */
export type TurkeyDocumentStatus = 'missing' | 'uploaded' | 'review' | 'approved' | 'rejected';

export interface TurkeyDocument {
  id: number;
  /** Localized by the server; the list depends on the degree. */
  name: string;
  /** What to send ("PDF, every page in one file"). */
  hint: string;
  required: boolean;
  status: TurkeyDocumentStatus;
  file_name: string | null;
  /** Why the team sent it back. */
  note: string | null;
}

export interface TurkeyAnswers {
  degree: TurkeyDegree;
  field: string;
  /** As typed ("17.25"). */
  gpa: string;
  /** When they want to start ("Fall 2027"). */
  start_term: string;
}

export interface TurkeyCase {
  step: TurkeyStep;
  answers: TurkeyAnswers | null;
  documents: TurkeyDocument[];
  /** While `sign`: the pledge to read, its version (stored with the signature) and code length. */
  pledge: {
    version: string;
    clauses: { title: string; text: string }[];
    code_length: number;
  } | null;
  /** The account's mobile, masked ("0912•••6789"): where the code goes. */
  phone: string;
}

/** What uploads accept. The server checks again. */
export const TURKEY_UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_TURKEY_UPLOAD_BYTES = 10 * 1024 * 1024;

const BASE = '/applicant/v1/turkey';

export const turkeyQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'turkey'],
  queryFn: ({ signal }) => api<TurkeyCase>(`${BASE}/`, { signal }),
  staleTime: 30_000,
});

/** Every change refreshes the applicant panel: the home card and access follow the request. */
function useTurkeyMutation<T, R = unknown>(mutationFn: (variables: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}

export function useStartTurkey() {
  return useTurkeyMutation((answers: TurkeyAnswers) =>
    api(`${BASE}/start/`, { method: 'POST', body: answers }),
  );
}

export function useUploadTurkeyDocument() {
  return useTurkeyMutation(
    ({ id, file, messages }: { id: number; file: File; messages?: UploadMessages }) => {
      const body = new FormData();
      body.append('file', file);
      return uploadFile(`${BASE}/documents/${String(id)}/upload/`, body, file, messages);
    },
  );
}

/** Sends the uploads for review (again, after a document was sent back). */
export function useSubmitTurkey() {
  return useTurkeyMutation(() => api(`${BASE}/submit/`, { method: 'POST' }));
}

/** Texts the pledge code; answers how long until it may be sent again. */
export function useSendPledgeCode() {
  return useMutation({
    mutationFn: () => api<{ resend_in: number }>(`${BASE}/pledge/send-code/`, { method: 'POST' }),
  });
}

/** Signs the pledge. A wrong or expired code is a 400 with `code`. */
export function useSignPledge() {
  return useTurkeyMutation(({ code, version }: { code: string; version: string }) =>
    api(`${BASE}/pledge/sign/`, { method: 'POST', body: { code, version } }),
  );
}

export const isWrongCode = (error: unknown) => error instanceof ApiError && error.status === 400;
