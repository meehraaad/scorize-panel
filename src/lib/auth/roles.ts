import { ON_SERVER } from '@/lib/applicant/onServer';
import type { SessionUser } from './session';

/**
 * Roles decide which panels a user can open. The rules mirror the Django properties the current
 * site uses (user_profile/models.py: is_seller, is_executer, is_user_country_supervisor; the
 * can_write_* permissions), so both sites show the same panels to the same people.
 * The API still checks every request; roles here only shape the UI.
 */

/** apply/types.py TeamType */
export const Team = {
  SALES: 0,
  EXECUTIVE: 1,
  MARKETING: 2,
  MANAGEMENT: 3,
  SUPPORT: 4,
  TECHNICAL: 5,
  WRITING: 6,
  SEARCH: 7,
  LANGUAGE: 8,
} as const;

export type Role =
  'applicant' | 'supervisor' | 'writer' | 'sales' | 'founders' | 'attendance' | 'hr';

/** ai.use_founders_assistant: the four partners (Django group `Founders`), and superusers. */
export const FOUNDERS_PERMISSION = 'use_founders_assistant';

/**
 * The two keys of management > messages (user_profile.manage_system_messages / _ready_): the
 * automatic messages and the ready ones. Given on management > access.
 */
export const SYSTEM_MESSAGES_PERMISSION = 'manage_system_messages';
export const READY_MESSAGES_PERMISSION = 'manage_ready_messages';
export const MESSAGES_PERMISSIONS = [
  SYSTEM_MESSAGES_PERMISSION,
  READY_MESSAGES_PERMISSION,
] as const;

/** attendance.manage_attendance: the attendance section (src/features/attendance/api.ts). */
const ATTENDANCE_PERMISSION = 'manage_attendance';

/** apply.can_manage_support_staff: the HR panel (src/features/hr/api.ts). */
const HR_PERMISSION = 'can_manage_support_staff';

const WRITER_PERMISSIONS = [
  'can_write_sop',
  'can_write_cv',
  'can_write_recome',
  'can_write_ps',
  'can_write_ds',
  'can_write_pl',
];

function permissionSet(user: SessionUser) {
  return new Set([
    ...user.permissions.map((permission) => permission.codename),
    ...user.group_permissions.flatMap((group) => group.permissions.map((p) => p.codename)),
  ]);
}

/** Like Django's user.has_perm(): superusers have every permission. */
export function hasPermission(user: SessionUser, codename: string) {
  return user.is_superuser || permissionSet(user).has(codename);
}

/** Holds at least one of them (one codename: that one). */
export function hasAnyPermission(user: SessionUser, codenames: string | readonly string[]) {
  return (typeof codenames === 'string' ? [codenames] : codenames).some((codename) =>
    hasPermission(user, codename),
  );
}

/** user_is_support_staff(): has an active SupportStaff record. */
export function isActiveStaff(user: SessionUser) {
  return Boolean(user.staff?.is_active);
}

export function getRoles(user: SessionUser): Role[] {
  const staff = isActiveStaff(user);
  const team = user.staff?.team;
  const roles: Role[] = [];

  if (
    user.is_superuser ||
    // Same rule as the old React staff dashboard (/new-dashboard/): the executive team works on
    // applicant files. It reads only `staff.team` and `is_superuser` from whoami.
    (staff && team === Team.EXECUTIVE) ||
    hasPermission(user, 'can_manage_applicant') ||
    // Country supervisors outside the executive team (backend-changes.md, R2).
    user.is_country_supervisor
  ) {
    roles.push('supervisor');
  }
  if (WRITER_PERMISSIONS.some((codename) => hasPermission(user, codename))) roles.push('writer');
  // is_seller: needs an email and a sales or support team (or superuser).
  if (
    user.email &&
    (user.is_superuser || (staff && (team === Team.SALES || team === Team.SUPPORT)))
  ) {
    roles.push('sales');
  }
  // The management panel: the founders' assistant, the messages (either key) and access
  // (superusers). Each section checks its own key.
  if (
    (ON_SERVER.foundersAssistant && hasPermission(user, FOUNDERS_PERMISSION)) ||
    (ON_SERVER.messageCenter && hasAnyPermission(user, MESSAGES_PERMISSIONS)) ||
    (ON_SERVER.accessPage && user.is_superuser)
  )
    roles.push('founders');
  // Attendance: the key for the office terminal's reports (superusers hold it).
  if (ON_SERVER.attendance && hasPermission(user, ATTENDANCE_PERMISSION)) roles.push('attendance');
  // Human resources: staff files, joining and leaving, HR's tasks and calendar.
  if (ON_SERVER.hr && hasPermission(user, HR_PERMISSION)) roles.push('hr');
  // The applicant panel: everyone without a work panel (no contract = the guest state, V7 design),
  // and staff who also have an applicant file of their own (`whoami.applicant`, R1).
  if (roles.length === 0 || user.applicant) roles.push('applicant');

  return roles;
}
