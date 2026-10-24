/**
 * Router paths of the sales panel's pages. The panel lives at /sales (src/panels/sales); features
 * can't import panels, so the root is repeated here.
 */
export const SALES_ROOT = '/sales';

export const salesPath = (to = '') => (to ? `${SALES_ROOT}/${to}` : SALES_ROOT);

/** What the customer page opens with: the call log, a message, or a consultation session to log. */
export type LogIntent = 'call' | 'message' | 'meeting';

export function customerPath(id: number, log?: LogIntent, reservation?: number) {
  const params = new URLSearchParams();
  if (log) params.set('log', log);
  if (reservation) params.set('reservation', String(reservation));
  const query = params.toString();
  return `${SALES_ROOT}/customers/${String(id)}${query ? `?${query}` : ''}`;
}
