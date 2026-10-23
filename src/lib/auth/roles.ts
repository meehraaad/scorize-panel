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

export type Role = 'applicant' | 'supervisor' | 'writer' | 'sales';

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

/** user_is_support_staff(): has an active SupportStaff record. */
export function isActiveStaff(user: SessionUser) {
  // `is_active` is not in whoami yet (backend-changes.md, R3); until then a staff record counts.
  return Boolean(user.staff && user.staff.is_active !== false);
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
    // Country supervisors outside the executive team (backend-changes.md, R2; optional).
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
  // The applicant panel: everyone without a work panel (no contract = the guest state, V7 design),
  // and staff who also have an applicant file of their own. Until whoami sends `applicant`
  // (backend-changes.md, R1) that can't be known, so staff see only their work panels.
  if (roles.length === 0 || user.applicant) roles.push('applicant');

  return roles;
}
