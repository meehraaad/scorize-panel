import { attendanceQuery, monthRange, todayQuery, calendarQuery } from '@/features/marketing/api';
import { weekOf, weekStart } from '@/lib/calendar';
import i18n from '@/lib/i18n';
import { calendarKind } from '@/lib/i18n/useCalendar';
import { lazyPage } from '@/lib/router/lazyPage';
import { openingTaskList, taskListQuery, tasksQuery } from '@/lib/tasks/api';
import type { PanelDefinition } from '../types';

/**
 * The marketing team (User.is_marketer: the marketing team, `apply.can_market`, superusers).
 * Design: canvas "Scorize Marketing Panel". Phase 1: the day, tasks, the calendar and my
 * performance (attendance; KPIs come with the company-wide KPI system). The board, campaigns,
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
      id: 'tasks',
      to: 'tasks',
      label: 'panels.marketing.nav.tasks',
      tab: 'panels.marketing.tabs.tasks',
      icon: 'check',
    },
    {
      id: 'calendar',
      to: 'calendar',
      label: 'panels.marketing.nav.calendar',
      tab: 'panels.marketing.tabs.calendar',
      icon: 'calendar',
    },
    {
      id: 'performance',
      to: 'performance',
      label: 'panels.marketing.nav.performance',
      tab: 'panels.marketing.tabs.performance',
      icon: 'clock',
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
      path: 'tasks',
      ...lazyPage(() => import('./TasksPage'), ['tasks'], {
        data: ({ request }) => [tasksQuery('marketing'), openingTaskList('marketing', request.url)],
        skeleton: 'list',
      }),
    },
    {
      path: 'calendar',
      // `tasks`: a click on a day opens the new-task composer.
      ...lazyPage(() => import('@/features/marketing/CalendarPage'), ['marketing', 'tasks'], {
        data: () => [calendarQuery(weekOf(new Date(), weekStart(calendarKind(i18n.language))))],
        skeleton: 'board',
      }),
    },
    {
      path: 'performance',
      ...lazyPage(() => import('@/features/marketing/PerformancePage'), ['marketing'], {
        data: () => [attendanceQuery(monthRange(calendarKind(i18n.language)))],
        skeleton: 'detail',
      }),
    },
  ],
};
