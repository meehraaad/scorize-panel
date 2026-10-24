import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { caseKey, useSupervisorMutation } from './case';
import { SUPERVISOR_API } from './common';

/** An asked-for document: no file yet, a file to check, accepted, or sent back. */
export type DocumentState = 'missing' | 'review' | 'approved' | 'returned';

export interface CaseDocument {
  id: number;
  name: string;
  deadline: string | null;
  state: DocumentState;
  file: { name: string; url: string; ext: string; uploaded_at: string } | null;
  /** Why it was sent back (shown to the applicant). */
  note: string | null;
}

export type WritingType = 'sop' | 'cv' | 'recommendation' | 'ps' | 'ds' | 'pl';

export interface CaseWriting {
  type: WritingType;
  step: 'form' | 'writing' | 'ready';
  writer: string | null;
  delivered_at: string | null;
  file_url: string | null;
}

export interface CaseDocuments {
  documents: CaseDocument[];
  /** null: the contract has no writing services. */
  writing: CaseWriting[] | null;
  interests: string[];
}

export const documentsQuery = (id: number) =>
  queryOptions({
    queryKey: [...caseKey(id), 'documents'],
    queryFn: ({ signal }) =>
      api<CaseDocuments>(`${SUPERVISOR_API}/cases/${String(id)}/documents/`, { signal }),
  });

export function useReviewDocument(id: number) {
  return useSupervisorMutation(
    ({ document, approved, note }: { document: number; approved: boolean; note: string }) =>
      api(`${SUPERVISOR_API}/cases/${String(id)}/documents/${String(document)}/review/`, {
        method: 'POST',
        body: { approved, note },
      }),
  );
}

export interface NewDocument {
  name: string;
  deadline: string | null;
  note: string;
}

export function useRequestDocument(id: number) {
  return useSupervisorMutation((document: NewDocument) =>
    api(`${SUPERVISOR_API}/cases/${String(id)}/documents/`, { method: 'POST', body: document }),
  );
}
