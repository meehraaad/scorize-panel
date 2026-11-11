import { redirect } from 'react-router';
import {
  ATTENDANCE_PERMISSION,
  dailyQuery,
  devicesQuery,
  enrollmentsQuery,
  monthRange,
  peopleQuery,
  summaryQuery,
  todayValue,
} from '@/features/attendance/api';
import { queryClient } from '@/lib/api/queryClient';
import { hasPermission } from '@/lib/auth/roles';
import { sessionQuery, START_PATH } from '@/lib/auth/session';
import i18n from '@/lib/i18n';
import { calendarKind } from '@/lib/i18n/useCalendar';
import { lazyPage } from '@/lib/router/lazyPage';
import type { PanelDefinition } from '../types';

/** The pages check the key too: the role only decides what the menu shows. */
async function keyHolders() {
  const me = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
  return me && hasPermission(me, ATTENDANCE_PERMISSION) ? null : redirect(START_PATH);
}

/**
 * Attendance, for holders of the `manage_attendance` key (admins, HR): the office terminal's punches
 * as daily and monthly numbers, and which staff member each terminal number is. Django:
 * `api/attendance/v1/`. Every page is its own lazy chunk.
 */
export const attendancePanel: PanelDefinition = {
  id: 'attendance',
  path: 'attendance',
  name: 'panels.attendance.name',
  description: 'panels.attendance.description',
  icon: 'clock',
  tone: 'neutral',
  navLabel: 'panels.attendance.nav.label',
  navigation: [
    {
      id: 'daily',
      to: '',
      label: 'panels.attendance.nav.daily',
      tab: 'panels.attendance.tabs.daily',
      icon: 'clock',
    },
    {
      id: 'monthly',
      to: 'month',
      label: 'panels.attendance.nav.monthly',
      tab: 'panels.attendance.tabs.monthly',
      icon: 'calendar',
    },
    {
      id: 'settings',
      to: 'settings',
      label: 'panels.attendance.nav.settings',
      tab: 'panels.attendance.tabs.settings',
      icon: 'settings',
    },
  ],
  // Each route lists what its page shows first (docs/performance.md, "Page data").
  routes: [
    {
      index: true,
      ...lazyPage(() => import('@/features/attendance/DailyPage'), ['attendance'], {
        guard: keyHolders,
        data: () => {
          const today = todayValue();
          return [dailyQuery({ from: today, to: today })];
        },
        skeleton: 'list',
      }),
    },
    {
      path: 'month',
      ...lazyPage(() => import('@/features/attendance/MonthlyPage'), ['attendance'], {
        guard: keyHolders,
        data: () => [summaryQuery(monthRange(calendarKind(i18n.language)))],
        skeleton: 'list',
      }),
    },
    {
      path: 'settings',
      ...lazyPage(() => import('@/features/attendance/SettingsPage'), ['attendance'], {
        guard: keyHolders,
        data: () => [enrollmentsQuery, peopleQuery, devicesQuery],
        skeleton: 'list',
      }),
    },
  ],
};
