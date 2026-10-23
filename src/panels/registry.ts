import { getRoles, type Role } from '@/lib/auth/roles';
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
const START_KEY = 'scorize.panel.start';

/**
 * Which panel opens after login, for people with several (switcher → "open after login"):
 * the last one used, always a given one, or always ask (the chooser page).
 * Per device until Django stores it (backend-changes.md, R6).
 */
export type StartPreference = 'last' | 'ask' | Role;

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // Storage blocked: defaults apply.
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: defaults apply next time.
  }
}

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

export function rememberPanel(panel: PanelDefinition) {
  write(LAST_PANEL_KEY, panel.id);
}

/** The panel used last (if still allowed), else the highest-priority one the user can open. */
export function preferredPanel(user: SessionUser): PanelDefinition {
  const available = panelsFor(user);
  const last = read(LAST_PANEL_KEY);
  return available.find((panel) => panel.id === last) ?? available[0] ?? applicantPanel;
}

export function startPreference(): StartPreference {
  const value = read(START_KEY);
  return value === 'ask' || PANELS.some((panel) => panel.id === value)
    ? (value as StartPreference)
    : 'last';
}

export function setStartPreference(preference: StartPreference) {
  write(START_KEY, preference);
}

/**
 * Where to go after login. One panel: straight there. Several: the pinned panel, else the last
 * one used; the chooser when the user asked for it or has no last panel yet (first login here).
 */
export function startTarget(user: SessionUser): PanelDefinition | 'choose' {
  const available = panelsFor(user);
  if (available.length <= 1) return available[0] ?? applicantPanel;
  const preference = startPreference();
  if (preference === 'ask') return 'choose';
  const pinned = available.find((panel) => panel.id === preference);
  const last = available.find((panel) => panel.id === read(LAST_PANEL_KEY));
  return pinned ?? last ?? 'choose';
}
