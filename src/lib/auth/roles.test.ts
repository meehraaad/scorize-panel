import { describe, expect, it } from 'vitest';
import { Team, getRoles, hasPermission } from './roles';
import type { SessionUser } from './session';

const base: SessionUser = {
  id: 1,
  first_name: 'A',
  last_name: 'B',
  email: 'a@example.com',
  phone_number: null,
  staff: null,
  is_superuser: false,
  permissions: [],
  group_permissions: [],
};

const staff = (team: number, extra: Partial<SessionUser> = {}): SessionUser => ({
  ...base,
  staff: { id: 9, full_name: 'Staff', team },
  ...extra,
});

describe('roles', () => {
  it('gives every account the applicant panel', () => {
    expect(getRoles(base)).toEqual(['applicant']);
  });

  it('maps teams like Django (sales and support are sellers)', () => {
    expect(getRoles(staff(Team.SALES))).toEqual(['sales', 'applicant']);
    expect(getRoles(staff(Team.SUPPORT))).toEqual(['sales', 'applicant']);
    expect(getRoles(staff(Team.EXECUTIVE))).toEqual(['supervisor', 'applicant']);
  });

  it('needs an email to be a seller, like User.is_seller', () => {
    expect(getRoles(staff(Team.SALES, { email: null }))).toEqual(['applicant']);
  });

  it('reads writer permissions from groups too', () => {
    const writer = staff(Team.WRITING, {
      group_permissions: [{ name: 'Writers', permissions: [{ codename: 'can_write_cv' }] }],
    });
    expect(getRoles(writer)).toEqual(['writer', 'applicant']);
  });

  it('supports several roles at once', () => {
    const user = staff(Team.EXECUTIVE, { permissions: [{ codename: 'can_write_sop' }] });
    expect(getRoles(user)).toEqual(['supervisor', 'writer', 'applicant']);
  });

  it('ignores inactive staff', () => {
    expect(
      getRoles(
        staff(Team.EXECUTIVE, { staff: { id: 1, full_name: 'X', team: 1, is_active: false } }),
      ),
    ).toEqual(['applicant']);
  });

  it('treats superusers as having every permission', () => {
    const admin = { ...base, is_superuser: true };
    expect(hasPermission(admin, 'anything')).toBe(true);
    expect(getRoles(admin)).toEqual(['supervisor', 'writer', 'sales', 'applicant']);
  });
});
