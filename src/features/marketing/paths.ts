/**
 * Router paths of the marketing panel's pages. The panel lives at /marketing (src/panels/marketing);
 * features can't import panels, so the root is repeated here.
 */
export const MARKETING_ROOT = '/marketing';

export const marketingPath = (to = '') => (to ? `${MARKETING_ROOT}/${to}` : MARKETING_ROOT);
