import { redirect } from 'react-router';
import {
  ATTENDANCE_PERMISSION,
  dailyQuery,
  monthRange,
  summaryQuery,
  todayValue,
} from '@/features/attendance/api';
import {
  HR_PERMISSION,
  calendarQuery,
  fileQuery,
  movesQuery,
  staffQuery,
  todayQuery,
} from '@/features/hr/api';
import { queryClient } from '@/lib/api/queryClient';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery, START_PATH } from '@/lib/auth/session';
import { weekOf, weekStart } from '@/lib/calendar';
import i18n from '@/lib/i18n';
import { calendarKind } from '@/lib/i18n/useCalendar';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { openingTaskList, tasksQuery } from '@/lib/tasks/api';
import type { PanelDefinition } from '../types';

/** The pages check the key too: the role only decides what the menu shows. */
const holders = (permission: string) => async () => {
  const me = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  return me && hasPermission(me, permission) ? null : redirect(START_PATH);
};
const hrOnly = holders(HR_PERMISSION);
const attendanceOnly = holders(ATTENDANCE_PERMISSION);

/**
 * Human resources, for holders of `can_manage_support_staff` (design: "HR panel" canvas v2): HR's
 * day, tasks and calendar like every panel, the staff files, joining and leaving checklists, and
 * the office terminal's attendance (the attendance pages, for holders of that key too). Django:
 * `api/hr/v1/`. Every page is its own lazy chunk.
 */
export const hrPanel: PanelDefinition = {
  id: 'hr',
  path: 'hr',
  name: 'panels.hr.name',
  description: 'panels.hr.description',
  icon: 'user',
  tone: 'info',
  navLabel: 'panels.hr.nav.label',
  navigation: [
    {
      id: 'today',
      to: '',
      label: 'panels.hr.nav.today',
      tab: 'panels.hr.tabs.today',
      icon: 'home',
    },
    {
      id: 'tasks',
      to: 'tasks',
      label: 'panels.hr.nav.tasks',
      tab: 'panels.hr.tabs.tasks',
      icon: 'check',
    },
    {
      id: 'calendar',
      to: 'calendar',
      label: 'panels.hr.nav.calendar',
      tab: 'panels.hr.tabs.calendar',
      icon: 'calendar',
    },
    {
      id: 'staff',
      to: 'staff',
      label: 'panels.hr.nav.staff',
      tab: 'panels.hr.tabs.staff',
      icon: 'user',
    },
    { id: 'moves', to: 'moves', label: 'panels.hr.nav.moves', icon: 'list' },
    {
      id: 'attendance',
      to: 'attendance',
      label: 'panels.hr.nav.attendance',
      icon: 'clock',
      permission: ATTENDANCE_PERMISSION,
    },
  ],
  // Each route lists what its page shows first (docs/performance.md, "Page data").
  routes: [
    {
      index: true,
      ...lazyPage(() => import('@/features/hr/TodayPage'), ['hr'], {
        guard: hrOnly,
        data: () => [todayQuery],
        skeleton: 'dashboard',
      }),
    },
    {
      path: 'tasks',
      ...lazyPage(() => import('./TasksPage'), ['tasks'], {
        guard: hrOnly,
        data: ({ request }) => [tasksQuery('hr'), openingTaskList('hr', request.url)],
        skeleton: 'list',
      }),
    },
    {
      path: 'calendar',
      // `tasks`: a click on a day opens the new-task composer.
      ...lazyPage(() => import('@/features/hr/CalendarPage'), ['hr', 'tasks'], {
        guard: hrOnly,
        data: () => [calendarQuery(weekOf(new Date(), weekStart(calendarKind(i18n.language))))],
        skeleton: 'board',
      }),
    },
    {
      path: 'staff',
      ...lazyPage(() => import('@/features/hr/StaffPage'), ['hr'], {
        guard: hrOnly,
        data: () => [staffQuery()],
        skeleton: 'list',
      }),
    },
    {
      path: 'staff/:id',
      ...lazyPage(() => import('@/features/hr/PersonPage'), ['hr'], {
        guard: hrOnly,
        data: ({ params }) => {
          const id = idParam(params.id);
          return [id !== null && fileQuery(id)];
        },
        skeleton: 'detail',
      }),
    },
    {
      path: 'moves',
      ...lazyPage(() => import('@/features/hr/MovesPage'), ['hr'], {
        guard: hrOnly,
        data: () => [movesQuery],
        skeleton: 'list',
      }),
    },
    // The attendance section's daily and monthly reports, inside HR.
    {
      path: 'attendance',
      ...lazyPage(() => import('@/features/attendance/DailyPage'), ['attendance'], {
        guard: attendanceOnly,
        data: () => {
          const today = todayValue();
          return [dailyQuery({ from: today, to: today })];
        },
        skeleton: 'list',
      }),
    },
    {
      path: 'attendance/month',
      ...lazyPage(() => import('@/features/attendance/MonthlyPage'), ['attendance'], {
        guard: attendanceOnly,
        data: () => [summaryQuery(monthRange(calendarKind(i18n.language)))],
        skeleton: 'list',
      }),
    },
  ],
};
