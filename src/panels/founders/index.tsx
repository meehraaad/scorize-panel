import { redirect } from 'react-router';
import {
  groupsQuery,
  historyQuery as accessHistoryQuery,
  keysQuery,
  peopleFilterOf,
  peopleQuery,
} from '@/features/access/api';
import { assistantsQuery, conversationQuery, conversationsQuery } from '@/features/assistant/api';
import {
  FIRST_READY_KIND,
  MESSAGES_PATH,
  READY_PERMISSION,
  SYSTEM_PERMISSION,
  readyMessagesQuery,
  readyVariablesQuery,
  systemMessagesQuery,
} from '@/features/messages/api';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { queryClient } from '@/lib/api/queryClient';
import { FOUNDERS_PERMISSION, MESSAGES_PERMISSIONS, hasPermission } from '@/lib/auth/roles';
import { START_PATH, sessionQuery, useUser, type SessionUser } from '@/lib/auth/session';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import type { NavItem, PanelDefinition } from '../types';

const assistantPage = () => import('@/features/assistant/AssistantPage');
const sessionUser = () => queryClient.query({ ...sessionQuery, staleTime: 'static' });

/** The first page of the panel someone may open: the assistant, else the messages, else access. */
export function managementHome(user: SessionUser) {
  if (ON_SERVER.foundersAssistant && hasPermission(user, FOUNDERS_PERMISSION)) return '/founders';
  if (ON_SERVER.messageCenter && hasPermission(user, SYSTEM_PERMISSION)) return MESSAGES_PATH;
  if (ON_SERVER.messageCenter && hasPermission(user, READY_PERMISSION))
    return `${MESSAGES_PATH}/ready`;
  if (ON_SERVER.accessPage && user.is_superuser) return '/founders/access';
  return null;
}

/** A page needing `allowed`: anyone else goes to the first page they may open. */
const needs = (allowed: (user: SessionUser) => boolean) => async () => {
  const user = await sessionUser();
  if (user && allowed(user)) return null;
  const home = user && managementHome(user);
  return redirect(home && home !== '/founders' ? home : START_PATH);
};

const assistantOnly = needs((user) => hasPermission(user, FOUNDERS_PERMISSION));
const messagesKey = (permission: string) => needs((user) => hasPermission(user, permission));
const superusersOnly = needs((user) => user.is_superuser);

const NAVIGATION: NavItem[] = [
  ...(ON_SERVER.foundersAssistant
    ? [
        {
          id: 'assistant',
          to: '',
          label: 'panels.founders.nav.assistant',
          tab: 'panels.founders.tabs.assistant',
          icon: 'chat',
          permission: FOUNDERS_PERMISSION,
        } satisfies NavItem,
      ]
    : []),
  ...(ON_SERVER.messageCenter
    ? [
        {
          id: 'messages',
          to: 'messages',
          label: 'panels.founders.nav.messages',
          tab: 'panels.founders.tabs.messages',
          icon: 'bell',
          permission: MESSAGES_PERMISSIONS,
        } satisfies NavItem,
      ]
    : []),
  ...(ON_SERVER.accessPage
    ? [
        {
          id: 'access',
          to: 'access',
          label: 'panels.founders.nav.access',
          tab: 'panels.founders.tabs.access',
          icon: 'shield',
        } satisfies NavItem,
      ]
    : []),
];

const NOT_SUPERUSER: ReadonlySet<string> = new Set(['access']);
const NONE: ReadonlySet<string> = new Set();

/**
 * The management panel: the partners' analysis assistant (Django group `Founders`, scorize `ai/`),
 * the messages (every automatic message, the ready ones; their two keys) and access (superusers:
 * every key, groups, who holds what). Each person sees the sections their keys open.
 */
export const foundersPanel: PanelDefinition = {
  id: 'founders',
  path: 'founders',
  name: 'panels.founders.name',
  description: 'panels.founders.description',
  icon: 'chart',
  tone: 'primary',
  navLabel: 'panels.founders.nav.label',
  navigation: NAVIGATION,
  useHiddenNav: () => (useUser().is_superuser ? NONE : NOT_SUPERUSER),
  // Each route lists what its page shows first (docs/performance.md, "Page data").
  routes: [
    {
      index: true,
      ...lazyPage(assistantPage, ['assistant'], {
        guard: assistantOnly,
        data: () => [assistantsQuery(), conversationsQuery(1)],
        skeleton: 'assistant',
      }),
    },
    {
      path: 'conversations/:id',
      ...lazyPage(assistantPage, ['assistant'], {
        guard: assistantOnly,
        data: ({ params }) => {
          const id = idParam(params.id);
          return [id !== null && conversationQuery(id), conversationsQuery(1)];
        },
        skeleton: 'assistant',
      }),
    },
    ...(ON_SERVER.messageCenter
      ? [
          {
            path: 'messages',
            ...lazyPage(() => import('@/features/messages/MessagesLayout'), ['messages']),
            children: [
              {
                index: true,
                ...lazyPage(() => import('@/features/messages/SystemMessagesPage'), [], {
                  guard: messagesKey(SYSTEM_PERMISSION),
                  data: () => [systemMessagesQuery],
                  skeleton: 'list',
                }),
              },
              {
                path: 'ready',
                ...lazyPage(() => import('@/features/messages/ReadyMessagesPage'), [], {
                  guard: messagesKey(READY_PERMISSION),
                  data: () => [readyMessagesQuery(FIRST_READY_KIND), readyVariablesQuery],
                  skeleton: 'list',
                }),
              },
            ],
          },
        ]
      : []),
    ...(ON_SERVER.accessPage
      ? [
          {
            path: 'access',
            loader: superusersOnly,
            ...lazyPage(() => import('@/features/access/AccessLayout'), ['access']),
            children: [
              {
                index: true,
                ...lazyPage(() => import('@/features/access/PeoplePage'), [], {
                  data: ({ request }) => [
                    peopleQuery(peopleFilterOf(new URL(request.url).searchParams)),
                    groupsQuery,
                    keysQuery(),
                  ],
                  skeleton: 'list',
                }),
              },
              {
                path: 'groups',
                ...lazyPage(() => import('@/features/access/GroupsPage'), [], {
                  data: () => [groupsQuery, keysQuery()],
                  skeleton: 'list',
                }),
              },
              {
                path: 'keys',
                ...lazyPage(() => import('@/features/access/KeysPage'), [], {
                  data: () => [keysQuery(), groupsQuery],
                  skeleton: 'list',
                }),
              },
              {
                path: 'history',
                ...lazyPage(() => import('@/features/access/HistoryPage'), [], {
                  data: () => [accessHistoryQuery(1), keysQuery()],
                  skeleton: 'list',
                }),
              },
            ],
          },
        ]
      : []),
  ],
};
