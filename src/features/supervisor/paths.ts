/**
 * Router paths of the supervisor panel's pages. The panel lives at /supervisor
 * (src/panels/supervisor); features can't import panels, so the root is repeated here.
 */
export const SUPERVISOR_ROOT = '/supervisor';

export const supervisorPath = (to = '') => (to ? `${SUPERVISOR_ROOT}/${to}` : SUPERVISOR_ROOT);

/** Tabs of a case file; '' is the overview. */
export type CaseTab = '' | 'documents' | 'applications' | 'tickets' | 'activity';

export const casePath = (id: number, tab: CaseTab = '') =>
  `${SUPERVISOR_ROOT}/files/${String(id)}${tab ? `/${tab}` : ''}`;

/** The list of every case, optionally on one stage or with the email bot on or off. */
export const casesPath = (stage?: string, bot?: 'on' | 'off') => {
  const query = new URLSearchParams();
  if (stage) query.set('stage', stage);
  if (bot) query.set('bot', bot);
  const search = query.toString();
  return `${SUPERVISOR_ROOT}/files${search ? `?${search}` : ''}`;
};
