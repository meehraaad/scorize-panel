import { queryOptions } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';

/**
 * The case's documents (H8): read by the documents tab, and by the applications tab for the
 * research interests.
 */

/** A document the team asked for that has no file yet (UploadRequiredDocument without a file). */
export interface RequiredDocument {
  id: number;
  name: string;
  deadline: string | null;
  /** Why an earlier file was sent back, written by the supervisor. */
  note: string | null;
}

export interface CaseFile {
  id: number;
  name: string;
  url: string;
  /** File extension in capitals: PDF, JPG, DOCX. */
  ext: string;
  uploaded_at: string;
  /** "me": uploaded by the applicant; "team": delivered by the writing team. */
  source: 'me' | 'team';
  /** The applicant may still remove it (until the supervisor has reviewed it). */
  can_delete: boolean;
  /** Own files: `review` until the supervisor has checked them; the team's files are `approved`. */
  state: 'review' | 'approved';
}

export type WritingType = 'sop' | 'cv' | 'recommendation' | 'ps' | 'ds' | 'pl';

export interface WritingOrder {
  type: WritingType;
  /** form: waiting for the applicant's information; writing: with the team; ready: delivered. */
  step: 'form' | 'writing' | 'ready';
  delivered_at: string | null;
  /** The delivered file, when ready. */
  file_url: string | null;
  /** A draft waits for the applicant to approve it or ask for changes (the step "your review"). */
  draft_waiting: boolean;
  /** While the team writes: when the next version is due. */
  due_at: string | null;
}

export interface DocumentsData {
  progress: { uploaded: number; required: number };
  required: RequiredDocument[];
  files: CaseFile[];
  /** null: the contract has no writing services (the section is hidden). */
  writing: WritingOrder[] | null;
  /** Research interests the professor-email bot searches with (in English). */
  interests: string[];
}



export const documentsQuery = queryOptions({
  queryKey: [...APPLICANT_KEY, 'documents'],
  queryFn: async ({ signal }): Promise<DocumentsData | null> => {
    try {
      return await api<DocumentsData>('/applicant/v1/documents/', { signal });
    } catch (error) {
      // No applicant file yet (no contract).
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  staleTime: 60_000,
});
