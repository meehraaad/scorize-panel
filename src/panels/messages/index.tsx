import { redirect } from 'react-router';
import {
  accessQuery,
  FIRST_READY_KIND,
  READY_PERMISSION,
  readyMessagesQuery,
  SYSTEM_PERMISSION,
  systemMessagesQuery,
} from '@/features/messages/api';
import { queryClient } from '@/lib/api/queryClient';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery, START_PATH, useUser } from '@/lib/auth/session';
import { lazyPage } from '@/lib/router/lazyPage';
import type { PanelDefinition } from '../types';

const user = () => queryClient.query({ ...sessionQuery, staleTime: 'static' });

/**
 * Each page needs its key: holders of only the other one land on its page, and people with neither
 * go back to the start (which opens a panel they have), so the two pages never send each other back.
 */
async function needs(permission: string, other: string, otherPath: string) {
  const me = await user();
  if (me && hasPermission(me, permission)) return null;
  return redirect(me && hasPermission(me, other) ? otherPath : START_PATH);
}

const systemKeyOnly = () => needs(SYSTEM_PERMISSION, READY_PERMISSION, '/messages/ready');
const readyKeyOnly = () => needs(READY_PERMISSION, SYSTEM_PERMISSION, '/messages');

/** The keys are given out by superusers. */
async function superusersOnly() {
  const me = await user();
  return me?.is_superuser ? null : redirect('/messages');
}

const NOT_SUPERUSER: ReadonlySet<string> = new Set(['access']);
const NONE: ReadonlySet<string> = new Set();

/**
 * The messages section, for holders of its keys: every message the site sends on its own (when, to
 * whom, its text), the ready messages for sellers and tickets, and (superusers) who holds the keys.
 * Django: `api/messages/v1/`.
 */
export const messagesPanel: PanelDefinition = {
  id: 'messages',
  path: 'messages',
  name: 'panels.messages.name',
  description: 'panels.messages.description',
  icon: 'bell',
  tone: 'info',
  navLabel: 'panels.messages.nav.label',
  useHiddenNav: () => (useUser().is_superuser ? NONE : NOT_SUPERUSER),
  navigation: [
    {
      id: 'system',
      to: '',
      label: 'panels.messages.nav.system',
      tab: 'panels.messages.tabs.system',
      icon: 'bell',
      permission: SYSTEM_PERMISSION,
    },
    {
      id: 'ready',
      to: 'ready',
      label: 'panels.messages.nav.ready',
      tab: 'panels.messages.tabs.ready',
      icon: 'chat',
      permission: READY_PERMISSION,
    },
    {
      id: 'access',
      to: 'access',
      label: 'panels.messages.nav.access',
      tab: 'panels.messages.tabs.access',
      icon: 'shield',
    },
  ],
  // Each route lists what its page shows first (docs/performance.md, "Page data").
  routes: [
    {
      index: true,
      ...lazyPage(() => import('@/features/messages/SystemMessagesPage'), ['messages'], {
        guard: systemKeyOnly,
        data: () => [systemMessagesQuery],
        skeleton: 'list',
      }),
    },
    {
      path: 'ready',
      ...lazyPage(() => import('@/features/messages/ReadyMessagesPage'), ['messages'], {
        guard: readyKeyOnly,
        data: () => [readyMessagesQuery(FIRST_READY_KIND)],
        skeleton: 'list',
      }),
    },
    {
      path: 'access',
      ...lazyPage(() => import('@/features/messages/AccessPage'), ['messages'], {
        guard: superusersOnly,
        data: () => [accessQuery],
        skeleton: 'list',
      }),
    },
  ],
};
