import { redirect } from 'react-router';
import { acquisitionQuery } from '@/features/marketing/acquisitionApi';
import { attendanceQuery, calendarQuery, monthRange, todayQuery } from '@/features/marketing/api';
import { MARKETING_MANAGER_PERMISSION, boardQuery, teamQuery } from '@/features/marketing/boardApi';
import { sourcesQuery } from '@/features/marketing/sourcesApi';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { queryClient } from '@/lib/api/queryClient';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery } from '@/lib/auth/session';
import { weekOf, weekStart } from '@/lib/calendar';
import i18n from '@/lib/i18n';
import { calendarKind } from '@/lib/i18n/useCalendar';
import { lazyPage } from '@/lib/router/lazyPage';
import { hubAddressFor, taskListQuery, tasksQuery } from '@/lib/tasks/api';
import { pathwayRoutes } from '../pathwayRoutes';
import type { NavItem, PanelDefinition } from '../types';

/** The manager's pages check the key too: the menu only hides them. */
async function managerOnly() {
  const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  return user && hasPermission(user, MARKETING_MANAGER_PERMISSION) ? null : redirect('/marketing');
}

/**
 * The marketing team (User.is_marketer: the marketing team, `apply.can_market`, superusers).
 * Design: canvas "Scorize Marketing Panel". The day, the board (cards whose current step is a task),
 * tasks, the calendar and my performance (attendance; KPIs come with the company-wide KPI system),
 * and the manager's area (team, stages, card types; `apply.can_manage_marketing`). Campaigns,
 * admissions and reports follow. Django: `api/marketing/v1/`; tasks `?panel=marketing`.
 */
export const marketingPanel: PanelDefinition = {
  id: 'marketing',
  path: 'marketing',
  name: 'panels.marketing.name',
  description: 'panels.marketing.description',
  icon: 'chart',
  tone: 'primary',
  navLabel: 'panels.marketing.nav.label',
  navigation: [
    {
      id: 'today',
      to: '',
      label: 'panels.marketing.nav.today',
      tab: 'panels.marketing.tabs.today',
      icon: 'home',
    },
    {
      id: 'board',
      to: 'board',
      label: 'panels.marketing.nav.board',
      tab: 'panels.marketing.tabs.board',
      icon: 'grid',
    },
    {
      id: 'leads',
      to: 'leads',
      label: 'panels.marketing.nav.leads',
      tab: 'panels.marketing.tabs.leads',
      icon: 'user',
    },
    {
      id: 'calendar',
      to: 'calendar',
      label: 'panels.marketing.nav.calendar',
      tab: 'panels.marketing.tabs.calendar',
      icon: 'calendar',
    },
    ...(ON_SERVER.acquisition
      ? [
          {
            id: 'acquisition',
            to: 'acquisition',
            label: 'panels.marketing.nav.acquisition',
            tab: 'panels.marketing.tabs.acquisition',
            icon: 'chart',
          } satisfies NavItem,
        ]
      : []),
    {
      id: 'performance',
      to: 'performance',
      label: 'panels.marketing.nav.performance',
      icon: 'clock',
    },
    {
      id: 'manage',
      to: 'manage',
      label: 'panels.marketing.nav.manage',
      icon: 'settings',
      permission: MARKETING_MANAGER_PERMISSION,
    },
  ],
  // Each route lists what its page shows first (docs/performance.md, "Page data").
  routes: [
    {
      index: true,
      ...lazyPage(() => import('@/features/marketing/TodayPage'), ['marketing'], {
        data: () => [todayQuery, tasksQuery('marketing'), taskListQuery('marketing', 'mine', 1)],
        skeleton: 'dashboard',
      }),
    },
    {
      path: 'board',
      ...lazyPage(() => import('@/features/marketing/BoardPage'), ['marketing'], {
        data: () => [boardQuery],
        skeleton: 'board',
      }),
    },
    {
      path: 'leads',
      // `leads`: the CSV upload dialog and the system sources' names.
      ...lazyPage(() => import('@/features/marketing/LeadsPage'), ['marketing', 'leads'], {
        data: () => [sourcesQuery],
        skeleton: 'list',
      }),
    },
    // Its tasks are on the shared page now: old links and bookmarks open them there.
    { path: 'tasks', loader: ({ request }) => redirect(hubAddressFor('marketing', request.url)) },
    {
      path: 'calendar',
      // `tasks`: a click on a day opens the new-task composer.
      ...lazyPage(() => import('@/features/marketing/CalendarPage'), ['marketing', 'tasks'], {
        data: () => [calendarQuery(weekOf(new Date(), weekStart(calendarKind(i18n.language))))],
        skeleton: 'board',
      }),
    },
    ...(ON_SERVER.acquisition
      ? [
          {
            path: 'acquisition',
            ...lazyPage(() => import('@/features/marketing/AcquisitionPage'), ['telemetry'], {
              data: () => [acquisitionQuery()],
              skeleton: 'dashboard',
            }),
          },
        ]
      : []),
    {
      path: 'performance',
      ...lazyPage(() => import('@/features/marketing/PerformancePage'), ['marketing'], {
        data: () => [attendanceQuery(monthRange(calendarKind(i18n.language)))],
        skeleton: 'detail',
      }),
    },
    {
      path: 'manage',
      ...lazyPage(() => import('@/features/marketing/manage/ManageLayout'), ['marketing'], {
        guard: managerOnly,
      }),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/marketing/manage/TeamPage'), [], {
            data: () => [teamQuery, boardQuery],
            skeleton: 'list',
          }),
        },
        {
          path: 'stages',
          ...lazyPage(() => import('@/features/marketing/manage/StagesPage'), [], {
            data: () => [boardQuery],
            skeleton: 'detail',
          }),
        },
        {
          path: 'types',
          ...lazyPage(() => import('@/features/marketing/manage/TypesPage'), [], {
            data: () => [boardQuery],
            skeleton: 'detail',
          }),
        },
        // Migration pathways, shared with the sales manager.
        ...pathwayRoutes(),
      ],
    },
  ],
};
