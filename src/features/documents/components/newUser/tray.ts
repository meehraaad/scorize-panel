import type { ReviewDocument, ReviewKind } from '@/lib/applicant/journey';
import type { WritingOffer } from '../../offers';

/** The documents of a case, in the order the review reads them. */
export const TRAY_KINDS = [
  'transcript',
  'language',
  'degree',
  'passport',
  'cv',
  'sop',
  'recommendation',
] as const satisfies readonly ReviewKind[];

/** The two the review needs most: they lead the "what you have" cards. */
export const KEY_KINDS: readonly ReviewKind[] = ['transcript', 'language'];
/** Documents only the person can send (the rest the writing team can write). */
export const UPLOAD_KINDS = ['transcript', 'language', 'degree', 'passport'] as const;

export interface TrayItem {
  kind: (typeof TRAY_KINDS)[number];
  /** done: a file was sent (or the team delivered it); started: an order of it is under way. */
  state: 'done' | 'started' | 'todo';
}

export function trayOf(files: ReviewDocument[], offers: WritingOffer[]): TrayItem[] {
  const sent = new Set(files.map((file) => file.kind));
  return TRAY_KINDS.map((kind) => {
    const order = offers.find((offer) => offer.kind === kind)?.order;
    if (sent.has(kind) || order?.step === 'ready') return { kind, state: 'done' };
    return { kind, state: order ? 'started' : 'todo' };
  });
}

/** The next document to ask for in the drop zone: the first the review needs that isn't in. */
export function nextKind(files: ReviewDocument[]): ReviewKind {
  const sent = new Set(files.map((file) => file.kind));
  return (
    (['transcript', 'language', 'degree', 'cv'] as const).find((kind) => !sent.has(kind)) ?? 'other'
  );
}
