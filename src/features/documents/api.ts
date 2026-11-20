/**
 * "Documents & writing" of the applicant panel. Shapes: docs/backend-changes.md H8–H11.
 * One request for the page; uploads, deletes and interest changes refresh every applicant page
 * (the home page shows document progress too).
 */

export {
  documentsQuery,
  type CaseFile,
  type DocumentsData,
  type RequiredDocument,
  type WritingOrder,
  type WritingType,
} from '@/lib/applicant/documents';

/** What the upload form accepts. The server checks again. */
export const UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const BASE = '/applicant/v1';

/** Some uploads failed; the rest went through. */
export class UploadError extends Error {
  constructor(readonly ids: number[]) {
    super('Upload failed');
    this.name = 'UploadError';
  }
}
