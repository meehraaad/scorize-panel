export const EXECUTIVE_API = '/executive/v1';
export const EXECUTIVE_KEY = ['executive'] as const;

/** A writing order's state, as Django's executive endpoints send it. */
export type WritingState = 'new' | 'drafting' | 'revision' | 'waiting_applicant' | 'delivered';
