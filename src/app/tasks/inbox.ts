import type { SessionUser } from '@/lib/auth/session';
import { taskPanelOf, type TasksPanel } from '@/lib/tasks/api';
import { preferredPanel } from '@/panels/registry';

/**
 * The staff's tasks and notifications in one place (`/tasks`, the bell's popup): two tabs, tasks
 * first. Shared by the bell, the dock and the page.
 */
export type InboxTab = 'tasks' | 'notifications';
export const INBOX_TABS: readonly InboxTab[] = ['tasks', 'notifications'];

export const inboxTabOf = (value: string | null): InboxTab =>
  value === 'notifications' ? 'notifications' : 'tasks';

/** The page's address for a tab (and the panel whose tasks it shows). */
export function inboxHref(tab: InboxTab, panel?: TasksPanel) {
  const query = new URLSearchParams();
  if (tab === 'notifications') query.set('tab', tab);
  else if (panel && panel !== 'staff') query.set('panel', panel);
  const search = query.toString();
  return search ? `/tasks?${search}` : '/tasks';
}

/** A tab or a choice in a pill switch: the current one is ink, like the panel menu's page. */
export const pillClass = (current: boolean) =>
  `inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
    current
      ? 'bg-hero font-bold text-on-hero dark:bg-tint'
      : 'font-semibold text-text-2 hover:bg-canvas hover:text-text'
  }`;

/** Whose tasks the page shows: the address's `?panel=` when the user has it, else the panel used last. */
export const hubPanelOf = (user: SessionUser, query: URLSearchParams) =>
  taskPanelOf(user, query.get('panel') ?? preferredPanel(user).id);
