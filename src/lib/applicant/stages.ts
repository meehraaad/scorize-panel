/**
 * The six steps of a case, in order (Django maps the Applicant's status onto these): the home
 * page's case card and the applications page.
 */
export const STAGES = ['contract', 'writing', 'documents', 'apply', 'results', 'visa'] as const;
export type Stage = (typeof STAGES)[number];
