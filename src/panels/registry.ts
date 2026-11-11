import { api } from '@/lib/api/client';
import { queryClient } from '@/lib/api/queryClient';
import { getRoles, type Role } from '@/lib/auth/roles';
import { sessionQuery, type SessionUser } from '@/lib/auth/session';
import { applicantPanel } from './applicant';
import { foundersPanel } from './founders';
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
  foundersPanel,
  applicantPanel,
];

/**
 * Which panel opens after login, for people with several (switcher → "open after login"):
 * the last one used, always a given one, or always ask (the chooser page). Stored on the user
 * (`whoami.last_workspace` + `workspace_mode`, backend-changes.md R6), so it follows them across devices.
 */
export type StartPreference = 'last' | 'ask' | Role;

type Workspace = Pick<SessionUser, 'last_workspace' | 'workspace_mode'>;

const saveWorkspace = (change: Partial<Workspace>) =>
  api('/profile/auth/v1/workspace/', { method: 'PATCH', body: change });

export function panelsFor(user: SessionUser): PanelDefinition[] {
  const roles = getRoles(user);
  return PANELS.filter((panel) => roles.includes(panel.id));
}

/**
 * Every account may open the applicant panel, as a regular customer: staff reach it from a quiet
 * link even when it isn't one of their listed panels. Other panels need their role.
 */
export function canOpen(user: SessionUser, panel: PanelDefinition) {
  return panel.id === applicantPanel.id || getRoles(user).includes(panel.id);
}

/**
 * The panel just opened becomes the "last used" one, unless the user pinned another. Only the
 * server is told: it matters at the next login, and changing the cached session would re-render
 * every page. A failed save keeps the previous panel, so it isn't reported.
 */
export function rememberPanel(user: SessionUser, panel: PanelDefinition) {
  if (user.workspace_mode !== 'last' || user.last_workspace === panel.id) return;
  saveWorkspace({ last_workspace: panel.id }).catch(() => undefined);
}

/** The panel used last (if still allowed), else the highest-priority one the user can open. */
export function preferredPanel(user: SessionUser): PanelDefinition {
  const available = panelsFor(user);
  return (
    available.find((panel) => panel.id === user.last_workspace) ?? available[0] ?? applicantPanel
  );
}

export function startPreference(user: SessionUser): StartPreference {
  if (user.workspace_mode === 'ask') return 'ask';
  const pinned = PANELS.find((panel) => panel.id === user.last_workspace);
  return user.workspace_mode === 'always' && pinned ? pinned.id : 'last';
}

/** The user's own choice: saved, and the cached session follows so the switcher shows it. */
export async function setStartPreference(preference: StartPreference) {
  const change: Partial<Workspace> =
    preference === 'last' || preference === 'ask'
      ? { workspace_mode: preference }
      : { workspace_mode: 'always', last_workspace: preference };
  await saveWorkspace(change);
  queryClient.setQueryData(sessionQuery.queryKey, (user) => user && { ...user, ...change });
}

/**
 * Where to go after login. One panel: straight there. Several: the pinned panel, else the last
 * one used; the chooser when the user asked for it or has no last panel yet (first login).
 */
export function startTarget(user: SessionUser): PanelDefinition | 'choose' {
  const available = panelsFor(user);
  if (available.length <= 1) return available[0] ?? applicantPanel;
  if (startPreference(user) === 'ask') return 'choose';
  return available.find((panel) => panel.id === user.last_workspace) ?? 'choose';
}
