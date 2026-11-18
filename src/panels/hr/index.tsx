import { redirect } from 'react-router';
import {
  STAFF_ACCESS_PERMISSION,
  groupsQuery,
  historyQuery as accessHistoryQuery,
  keysQuery,
  peopleFilterOf,
  peopleQuery,
} from '@/features/access/api';
import {
  ATTENDANCE_PERMISSION,
  dailyQuery,
  devicesQuery,
  enrollmentsQuery,
  monthRange,
  peopleQuery as attendancePeopleQuery,
  scheduleQuery,
  summaryQuery,
  todayValue,
} from '@/features/attendance/api';
import {
  HR_PERMISSION,
  calendarQuery,
  fileQuery,
  movesQuery,
  optionsQuery,
  staffQuery,
  todayQuery,
} from '@/features/hr/api';
import {
  catalogQuery,
  kpisQuery,
  payMonth,
  paySettingsQuery,
  payrollQuery,
  resultsQuery,
  rulesQuery,
} from '@/features/hr/pay/api';
import { queryClient } from '@/lib/api/queryClient';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery, START_PATH } from '@/lib/auth/session';
import { weekOf, weekStart } from '@/lib/calendar';
import i18n from '@/lib/i18n';
import { calendarKind } from '@/lib/i18n/useCalendar';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import { openingTaskList, tasksQuery } from '@/lib/tasks/api';
import type { PanelDefinition } from '../types';

/**
 * The pages check the key too: the role only decides what the menu shows. Someone without this
 * page's key goes to the first part of the panel they may open: HR's day, else attendance (the
 * attendance key alone opens the panel for its section only).
 */
const holders = (permission: string) => async () => {
  const me = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  if (!me) return redirect(START_PATH);
  if (hasPermission(me, permission)) return null;
  if (permission !== HR_PERMISSION && hasPermission(me, HR_PERMISSION)) return redirect('/hr');
  if (permission !== ATTENDANCE_PERMISSION && hasPermission(me, ATTENDANCE_PERMISSION))
    return redirect('/hr/attendance');
  return redirect(START_PATH);
};
const hrOnly = holders(HR_PERMISSION);
const attendanceOnly = holders(ATTENDANCE_PERMISSION);
const accessOnly = holders(STAFF_ACCESS_PERMISSION);

/**
 * Human resources, for holders of `can_manage_support_staff` (design: "HR panel" canvas v2): HR's
 * day, tasks and calendar like every panel, the staff files, joining and leaving checklists, and
 * the office terminal's attendance (its day, month and settings: holders of the attendance key
 * alone see only that section). Django: `api/hr/v1/`, `api/attendance/v1/`. Every page is its own lazy chunk.
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
      permission: HR_PERMISSION,
      to: '',
      label: 'panels.hr.nav.today',
      tab: 'panels.hr.tabs.today',
      icon: 'home',
    },
    {
      id: 'tasks',
      permission: HR_PERMISSION,
      to: 'tasks',
      label: 'panels.hr.nav.tasks',
      tab: 'panels.hr.tabs.tasks',
      icon: 'check',
    },
    {
      id: 'calendar',
      permission: HR_PERMISSION,
      to: 'calendar',
      label: 'panels.hr.nav.calendar',
      tab: 'panels.hr.tabs.calendar',
      icon: 'calendar',
    },
    {
      id: 'staff',
      permission: HR_PERMISSION,
      to: 'staff',
      label: 'panels.hr.nav.staff',
      tab: 'panels.hr.tabs.staff',
      icon: 'user',
    },
    {
      id: 'moves',
      to: 'moves',
      label: 'panels.hr.nav.moves',
      icon: 'list',
      permission: HR_PERMISSION,
    },
    {
      id: 'attendance',
      to: 'attendance',
      label: 'panels.hr.nav.attendance',
      icon: 'clock',
      permission: ATTENDANCE_PERMISSION,
    },
    {
      id: 'pay',
      to: 'pay',
      label: 'panels.hr.nav.pay',
      icon: 'chart',
      permission: HR_PERMISSION,
    },
    {
      id: 'access',
      to: 'access',
      label: 'panels.hr.nav.access',
      icon: 'lock',
      permission: STAFF_ACCESS_PERMISSION,
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
    // Attendance (once its own panel, whose addresses redirect here): the day, the month per
    // person and the settings, each a sub-tab.
    {
      path: 'attendance',
      ...lazyPage(() => import('@/features/attendance/AttendanceLayout'), ['attendance'], {
        guard: attendanceOnly,
      }),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/attendance/DailyPage'), [], {
            data: () => {
              const today = todayValue();
              return [dailyQuery({ from: today, to: today })];
            },
            skeleton: 'list',
          }),
        },
        {
          path: 'month',
          ...lazyPage(() => import('@/features/attendance/MonthlyPage'), [], {
            data: () => [summaryQuery(monthRange(calendarKind(i18n.language)))],
            skeleton: 'list',
          }),
        },
        {
          path: 'settings',
          ...lazyPage(() => import('@/features/attendance/SettingsPage'), [], {
            data: () => [scheduleQuery, enrollmentsQuery, attendancePeopleQuery, devicesQuery],
            skeleton: 'list',
          }),
        },
      ],
    },
    // Pay and KPIs: the month's pay, the month's KPI values, the KPIs, rewards and penalties, the
    // settings.
    {
      path: 'pay',
      ...lazyPage(() => import('@/features/hr/pay/PayLayout'), ['hr'], { guard: hrOnly }),
      children: [
        {
          index: true,
          ...lazyPage(() => import('@/features/hr/pay/PayrollPage'), [], {
            data: () => [payrollQuery(payMonth())],
            skeleton: 'list',
          }),
        },
        {
          path: 'results',
          ...lazyPage(() => import('@/features/hr/pay/ResultsPage'), [], {
            data: () => [resultsQuery(payMonth())],
            skeleton: 'list',
          }),
        },
        {
          path: 'kpis',
          ...lazyPage(() => import('@/features/hr/pay/KpisPage'), [], {
            data: () => [kpisQuery, optionsQuery, catalogQuery],
            skeleton: 'list',
          }),
        },
        {
          path: 'rules',
          ...lazyPage(() => import('@/features/hr/pay/RulesPage'), [], {
            data: () => [rulesQuery, kpisQuery, optionsQuery, catalogQuery],
            skeleton: 'list',
          }),
        },
        {
          path: 'settings',
          ...lazyPage(() => import('@/features/hr/pay/SettingsPage'), [], {
            data: () => [paySettingsQuery],
            skeleton: 'detail',
          }),
        },
      ],
    },
    // Access (management > access's pages): HR gives staff keys and groups within limits; the API
    // keeps superusers, one's own access and protected keys out of reach.
    {
      path: 'access',
      ...lazyPage(() => import('@/features/access/AccessLayout'), ['access'], {
        guard: accessOnly,
      }),
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
  ],
};
