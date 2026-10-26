import type { WritingOrder } from './api';

/** A writing order's steps as the applicant sees them: the review of a draft is its own. */
export const WRITING_STEPS = ['form', 'writing', 'review', 'ready'] as const;
export type ShownStep = (typeof WRITING_STEPS)[number];

/** Where an order is, with the applicant's review of a draft as its own step. */
export const shownStep = (order: WritingOrder): ShownStep =>
  order.step === 'writing' && order.draft_waiting ? 'review' : order.step;
