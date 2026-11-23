import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toValue } from '@/lib/calendar';
import type { Face } from '@/lib/face/api';
import type { TaskCalendarData } from '@/lib/tasks/calendar';
import type { OnboardingBrief, PersonalInfo } from './onboarding/api';

/**
 * The HR panel: staff files, work contracts and salary history, joining and leaving checklists,
 * HR's calendar and day. Django: `api/hr/v1/` (lang `human_resource/`), key
 * `apply.can_manage_support_staff`. The staff list never carries salaries or national codes; a
 * file does.
 */
export const HR_PERMISSION = 'can_manage_support_staff';
export const HR_API = '/hr/v1';
export const HR_KEY = ['hr'] as const;

export type Team =
  | 'sales'
  | 'executive'
  | 'marketing'
  | 'management'
  | 'support'
  | 'technical'
  | 'writing'
  | 'search'
  | 'language';
export type ContractKind = 'trial' | 'fixed' | 'permanent' | 'project';
export type StaffState = 'active' | 'trial' | 'joining' | 'leaving' | 'inactive';
export type MoveKind = 'entry' | 'exit';
export type MoveStatus = 'open' | 'done' | 'cancelled';

export interface Named {
  id: number;
  name: string;
}

export interface Contract {
  id: number;
  kind: ContractKind;
  /** `YYYY-MM-DD`. */
  start: string;
  end: string | null;
  note: string;
  file: string | null;
}

export interface MoveStep {
  id: number;
  label: string;
  done: boolean;
  /** Its task (StaffToDo id): it shows on the owner's tasks page and calendar. */
  task: number | null;
  due: string | null;
  owner: Named | null;
}

export interface Move {
  id: number;
  kind: MoveKind;
  /** The first day of work (joining) or the last (leaving). */
  day: string;
  status: MoveStatus;
  reason: string;
  done: number;
  total: number;
  steps?: MoveStep[];
}

export interface OpenMove extends Move {
  staff: Named;
  steps: MoveStep[];
}

export interface StaffRow {
  /** SupportStaff id. */
  id: number;
  user: number;
  name: string;
  face: Face | null;
  position: Named | null;
  team: Team | null;
  manager: Named | null;
  personnel_code: string;
  entry_date: string | null;
  leaving_date: string | null;
  is_active: boolean;
  birth_date: string | null;
  contract: Contract | null;
  /** A number on the attendance terminal is theirs. */
  device: boolean;
  move: Move | null;
  state: StaffState;
  /**
   * The new-hire form (OB5): on a row the open one, on a file the latest. Absent until Django ships
   * it (`ON_SERVER.hrOnboarding`).
   */
  onboarding?: OnboardingBrief | null;
}

export interface StaffInfo {
  full_name: string;
  fathers_name: string;
  id_number: string;
  national_code: string;
  birth_place: string;
  birth_date: string | null;
  marital_status: 'single' | 'married' | null;
  number_of_children: number | null;
  degree: string | null;
  work_experience: number | null;
  address: string;
  phone_number: string | null;
  work_email: string;
  internal_email: string;
  internal_number: string | null;
  office_extension: string | null;
  mobile_extension: string | null;
}

export interface SalaryChange {
  id: number;
  amount: number;
  effective: string;
  note: string;
  by: string | null;
  at: string;
}

export interface HistoryRow {
  at: string;
  kind: 'joined' | 'contract' | 'salary' | 'entry' | 'exit' | 'left';
  by: string | null;
  contract?: ContractKind;
  end?: string | null;
  amount?: number;
  status?: MoveStatus;
  reason?: string;
}

export interface StaffFile extends StaffRow {
  info: StaffInfo;
  pay: {
    /** Tomans a month. */
    salary: number | null;
    has_insurance: boolean;
    commission: string;
    changes: SalaryChange[];
  };
  contracts: Contract[];
  documents: { id: number; type: Named; url: string | null }[];
  /** The terminal numbers that are theirs. */
  devices: number[];
  moves: (Move & { steps: MoveStep[] })[];
  history: HistoryRow[];
  /** What an approved new-hire form added (OB1); null before one. */
  personal?: PersonalInfo | null;
}

export interface HrToday {
  counts: Record<'active' | 'trial' | 'joining' | 'leaving' | 'total' | 'no_device', number> & {
    /** New-hire forms waiting for HR (OB5; absent until shipped). */
    forms_to_review?: number;
  };
  attendance: Record<'present' | 'late' | 'absent' | 'pending', number>;
  moves: OpenMove[];
  ending: { staff: Named; kind: ContractKind; end: string }[];
  birthdays: { staff: Named; day: string }[];
}

export type { CalendarTaskDay, CalendarTaskRow } from '@/lib/tasks/calendar';

export type HrEventKind = 'contract_end' | 'trial_end' | 'entry' | 'exit' | 'birthday';

export interface HrCalendar extends TaskCalendarData {
  events: { id: string; kind: HrEventKind; day: string; staff: Named }[];
}

export interface HrOptions {
  positions: (Named & { parent: number | null })[];
  teams: Team[];
  contracts: ContractKind[];
  document_types: Named[];
}

/**
 * A new staff member. HR sends the hire's phone (their login), first day, contract and salary; the
 * hire types their names and ID card number on the new-hire form. Until it is approved the file's
 * `name` is the phone and `info.id_number` is `''`.
 */
export interface NewStaff {
  phone_number: string;
  first_name?: string;
  last_name?: string;
  id_number?: string;
  /** Work email, optional. */
  email?: string;
  position?: number | null;
  team?: Team | null;
  entry_date: string;
  contract: ContractKind;
  contract_end?: string | null;
  salary: number;
}

export const todayQuery = queryOptions({
  queryKey: [...HR_KEY, 'today'],
  queryFn: ({ signal }) => api<HrToday>(`${HR_API}/today/`, { signal }),
});

export const optionsQuery = queryOptions({
  queryKey: [...HR_KEY, 'options'],
  queryFn: ({ signal }) => api<HrOptions>(`${HR_API}/options/`, { signal }),
  staleTime: 5 * 60_000,
});

/** Everyone working now; `all`: with the people who left. */
export const staffQuery = (all = false) =>
  queryOptions({
    queryKey: [...HR_KEY, 'staff', all],
    queryFn: ({ signal }) =>
      api<{ results: StaffRow[] }>(`${HR_API}/staff/${all ? '?all=1' : ''}`, { signal }),
  });

export const fileQuery = (id: number) =>
  queryOptions({
    queryKey: [...HR_KEY, 'file', id],
    queryFn: ({ signal }) => api<StaffFile>(`${HR_API}/staff/${String(id)}/`, { signal }),
  });

export const movesQuery = queryOptions({
  queryKey: [...HR_KEY, 'moves'],
  queryFn: ({ signal }) => api<{ results: OpenMove[] }>(`${HR_API}/moves/`, { signal }),
});

/** A week (or any range up to 42 days) of my tasks and HR's days. */
export const calendarQuery = (week: Date) => {
  const from = toValue(week, false);
  const to = toValue(new Date(week.getFullYear(), week.getMonth(), week.getDate() + 6), false);
  return queryOptions({
    queryKey: [...HR_KEY, 'calendar', from],
    queryFn: ({ signal }) =>
      api<HrCalendar>(`${HR_API}/calendar/?from=${from}&to=${to}`, { signal }),
  });
};

export const staffPath = (id: number, rest = '') => `${HR_API}/staff/${String(id)}/${rest}`;

export const documentPath = (id: number) => staffPath(id, 'documents/');
