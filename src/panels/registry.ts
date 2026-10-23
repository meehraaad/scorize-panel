import { getRoles } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { applicantPanel } from './applicant';
import { salesPanel } from './sales';
import { supervisorPanel } from './supervisor';
import type { PanelDefinition } from './types';
import { writerPanel } from './writer';

/**
 * Every panel of the site. Adding a panel = a folder in src/panels/ + one line here.
 * Order is the default priority: staff land in their work panel, everyone else in the applicant one.
 */
export const PANELS: readonly PanelDefinition[] = [
  supervisorPanel,
  writerPanel,
  salesPanel,
  applicantPanel,
];

const LAST_PANEL_KEY = 'scorize.panel';

export function panelsFor(user: SessionUser): PanelDefinition[] {
  const roles = getRoles(user);
  return PANELS.filter((panel) => roles.includes(panel.id));
}

export function canOpen(user: SessionUser, panel: PanelDefinition) {
  return getRoles(user).includes(panel.id);
}

export function rememberPanel(panel: PanelDefinition) {
  try {
    localStorage.setItem(LAST_PANEL_KEY, panel.id);
  } catch {
    // Storage blocked: the default panel is used next time.
  }
}

/** The panel used last (if still allowed), else the highest-priority one the user can open. */
export function preferredPanel(user: SessionUser): PanelDefinition {
  const available = panelsFor(user);
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_PANEL_KEY);
  } catch {
    // ignore
  }
  return available.find((panel) => panel.id === last) ?? available[0] ?? applicantPanel;
}
