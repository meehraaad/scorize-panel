import { redirect, type RouteObject } from 'react-router';
import {
  botRulesQuery,
  FIRST_MAILBOXES,
  gmailStatusQuery,
  MAIL_PERMISSION,
  mailboxesQuery,
  serversQuery,
} from '@/features/mail/api';
import {
  ASSIGN_PERMISSION,
  casesQuery,
  firstCasesQuery,
  handoffsQuery,
  managerTeamQuery,
  scopesQuery,
  serviceKindsQuery,
  servicesReportQuery,
} from '@/features/supervisor/api';
import { managerPath } from '@/features/supervisor/paths';
import { queryClient } from '@/lib/api/queryClient';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { lazyPage } from '@/lib/router/lazyPage';
import type { NavItem } from '../types';

const EXECUTIVE_HOME = '/executive';

/** The keys that open the tab: each opens its own sub-tabs (ManagerLayout). */
export const MANAGER_PERMISSIONS = ON_SERVER.mailServers
  ? [ASSIGN_PERMISSION, MAIL_PERMISSION]
  : [ASSIGN_PERMISSION];

export const managerNavItem: NavItem = {
  id: 'manager',
  to: 'manager',
  label: 'panels.executive.nav.manager',
  icon: 'settings',
  permission: MANAGER_PERMISSIONS,
};

const session = () => queryClient.query({ ...sessionQuery, staleTime: 'static' });
const canMail = (user: Awaited<ReturnType<typeof session>>) =>
  Boolean(ON_SERVER.mailServers && user && hasPermission(user, MAIL_PERMISSION));

/** The supervisor manager's pages: without that key, the mail page (or the panel's home). */
async function assignersOnly() {
  const user = await session();
  if (user && hasPermission(user, ASSIGN_PERMISSION)) return null;
  return redirect(canMail(user) ? managerPath('mail') : EXECUTIVE_HOME);
}

/** The mail page, for `mail_server.manage_mailboxes` once Django serves it. */
async function mailManagersOnly() {
  const user = await session();
  if (canMail(user)) return null;
  return redirect(user && hasPermission(user, ASSIGN_PERMISSION) ? managerPath() : EXECUTIVE_HOME);
}

/** The manager's pages about services wait for Django's client services. */
function managerServicesOn() {
  return Promise.resolve(ON_SERVER.clientServices ? null : redirect(managerPath()));
}

/**
 * The executive panel's management tab (/executive/manager): the supervisor manager's section and
 * the mail servers, moved here from the supervisor panel (whose old addresses redirect here).
 */
export const managerRoute: RouteObject = {
  path: 'manager',
  ...lazyPage(() => import('@/features/supervisor/manager/ManagerLayout'), ['supervisor']),
  children: [
    {
      loader: assignersOnly,
      children: [
        // New cases waiting for a supervisor, and services waiting for an owner.
        {
          index: true,
          ...lazyPage(() => import('@/features/supervisor/HandoffsPage'), [], {
            data: () => [handoffsQuery],
            skeleton: 'list',
          }),
        },
        // Every case with its supervisors (`?supervisor=`: one person's, from the team page).
        {
          path: 'cases',
          ...lazyPage(() => import('@/features/supervisor/manager/TeamCasesPage'), [], {
            data: ({ request }) => [
              casesQuery(firstCasesQuery(new URL(request.url).searchParams, true)),
              managerTeamQuery,
            ],
            skeleton: 'list',
          }),
        },
        // Each supervisor's and visa expert's load.
        {
          path: 'team',
          ...lazyPage(() => import('@/features/supervisor/manager/TeamPage'), [], {
            data: () => [managerTeamQuery],
            skeleton: 'list',
          }),
        },
        // Moving one person's cases to another.
        {
          path: 'move',
          ...lazyPage(() => import('@/features/supervisor/manager/MovePage'), [], {
            data: () => [managerTeamQuery],
            skeleton: 'form',
          }),
        },
        // How the services are answered, per team and owner (SVC6).
        {
          path: 'services',
          ...lazyPage(() => import('@/features/supervisor/ServicesReportPage'), [], {
            guard: managerServicesOn,
            data: () => [servicesReportQuery('month')],
            skeleton: 'list',
          }),
        },
        // Supervisors' scopes and where they differ from today's rule (SVC5).
        {
          path: 'scopes',
          ...lazyPage(() => import('@/features/supervisor/ScopesPage'), [], {
            guard: managerServicesOn,
            data: () => [scopesQuery],
            skeleton: 'list',
          }),
        },
        // The services: name, team, country rule, stages; new simple ones.
        {
          path: 'kinds',
          ...lazyPage(() => import('@/features/supervisor/manager/KindsPage'), [], {
            guard: managerServicesOn,
            data: () => [serviceKindsQuery],
            skeleton: 'list',
          }),
        },
      ],
    },
    // Our mail servers and the applicants' mailboxes.
    {
      path: 'mail',
      ...lazyPage(() => import('@/features/mail/MailPage'), ['mail'], {
        guard: mailManagersOnly,
        data: () => [
          serversQuery,
          gmailStatusQuery,
          botRulesQuery,
          mailboxesQuery(FIRST_MAILBOXES),
        ],
        skeleton: 'list',
      }),
    },
  ],
};
