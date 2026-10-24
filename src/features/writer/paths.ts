/**
 * Router paths of the writer panel (src/panels/writer, at /writer). Features can't import panels,
 * so the root is repeated here.
 */
export const WRITER_ROOT = '/writer';

export const orderPath = (id: number, tab: '' | 'tickets' = '') =>
  `${WRITER_ROOT}/orders/${String(id)}${tab ? `/${tab}` : ''}`;
