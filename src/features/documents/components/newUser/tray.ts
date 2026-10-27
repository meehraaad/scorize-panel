import type { ReviewDocument, ReviewKind } from '@/lib/applicant/journey';

/** Documents only the person can send, in the order the review reads them. */
export const UPLOAD_KINDS = ['transcript', 'language', 'degree', 'passport'] as const;

/** The next document to ask for in the hero: the first the review needs that isn't in. */
export function nextKind(files: ReviewDocument[]): ReviewKind {
  const sent = new Set(files.map((file) => file.kind));
  return (
    (['transcript', 'language', 'degree', 'cv'] as const).find((kind) => !sent.has(kind)) ?? 'other'
  );
}
