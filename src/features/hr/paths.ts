/**
 * Router paths of the HR panel's pages. The panel lives at /hr (src/panels/hr); features can't
 * import panels, so the root is repeated here.
 */
export const HR_ROOT = '/hr';

export const hrPath = (to = '') => (to ? `${HR_ROOT}/${to}` : HR_ROOT);

export const personPath = (id: number) => `${HR_ROOT}/staff/${String(id)}`;

/** A group's score plan (`all`, `position:<id>`, `team:<name>`, `person:<id>`). */
export const planPath = (key: string) => `${HR_ROOT}/pay/plans/${encodeURIComponent(key)}`;

/** The new hire's own form, under «من» (outside the HR panel: every staff member may have one). */
export const ONBOARDING_PATH = '/me/onboarding';

/** A team's page (`apply.types.TeamType`'s name, lower case). */
export const teamPath = (team: string) => `${HR_ROOT}/staff/teams/${encodeURIComponent(team)}`;

/** The staff page on its teams view. */
export const teamsPath = `${HR_ROOT}/staff?view=teams`;
