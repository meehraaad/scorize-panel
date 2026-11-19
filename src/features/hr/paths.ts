/**
 * Router paths of the HR panel's pages. The panel lives at /hr (src/panels/hr); features can't
 * import panels, so the root is repeated here.
 */
export const HR_ROOT = '/hr';

export const hrPath = (to = '') => (to ? `${HR_ROOT}/${to}` : HR_ROOT);

export const personPath = (id: number) => `${HR_ROOT}/staff/${String(id)}`;

/** A group's score plan (`all`, `position:<id>`, `team:<name>`, `person:<id>`). */
export const planPath = (key: string) => `${HR_ROOT}/pay/plans/${encodeURIComponent(key)}`;
