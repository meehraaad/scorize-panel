import { describe, expect, it } from 'vitest';
import { Team } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { canAssignTasks, canPenalize } from './rights';

const staff = (team: number, ...codenames: string[]): SessionUser => ({
  id: 1,
  first_name: 'A',
  last_name: 'B',
  email: 'a@example.com',
  phone_number: null,
  staff: { id: 9, full_name: 'Staff', team, is_active: true },
  is_superuser: false,
  permissions: codenames.map((codename) => ({ codename })),
  group_permissions: [],
  applicant: null,
  is_country_supervisor: false,
  last_workspace: null,
  workspace_mode: 'last',
});

/** The same rule as Django's `api/staff/v1/panels.py`, which checks it again on every task. */
describe('who gives a panel’s tasks to others', () => {
  it('a seller adds tasks for themselves only; the sales manager gives them too', () => {
    expect(canAssignTasks(staff(Team.SALES), 'sales')).toBe(false);
    expect(canAssignTasks(staff(Team.SALES, 'can_assign_to_seller'), 'sales')).toBe(true);
  });

  it('an admin key counts only in a panel the person is in', () => {
    // The marketing key without being in marketing, or the sales key in marketing: no.
    expect(canAssignTasks(staff(Team.SALES, 'can_manage_marketing'), 'marketing')).toBe(false);
    expect(canAssignTasks(staff(Team.MARKETING, 'can_assign_to_seller'), 'marketing')).toBe(false);
    expect(canAssignTasks(staff(Team.MARKETING, 'can_manage_marketing'), 'marketing')).toBe(true);
  });

  it('a task manager gives anyone’s tasks, the shared page’s too', () => {
    const manager = staff(Team.MANAGEMENT, 'can_manage_staff_todo');
    expect(canAssignTasks(manager, 'staff')).toBe(true);
    expect(canAssignTasks(staff(Team.SALES, 'can_assign_to_seller'), 'staff')).toBe(false);
  });

  it('a penalty needs its own key', () => {
    expect(canPenalize(staff(Team.SALES, 'can_assign_to_seller'))).toBe(false);
    expect(canPenalize(staff(Team.SALES, 'can_define_todo_penalty'))).toBe(true);
  });
});
