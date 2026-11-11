import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toValue } from '@/lib/calendar';
import { SALES_API } from '@/lib/sales/api';
import { CALENDAR_KEY, type CalendarVisit } from './calendar';
import { customerKey } from './customer';

/** An in-person meeting at the office (S75): an hour in one of the office's rooms. */
export type OfficeVisit = CalendarVisit;

export interface VisitSlot {
  at: string;
  /** Rooms free then; 0: every room is taken. */
  left: number;
  /** Active rooms. */
  capacity: number;
}

export interface VisitSlots {
  minutes: number;
  rooms: number;
  slots: VisitSlot[];
}

export interface CustomerVisits {
  upcoming: OfficeVisit | null;
  /** Active meeting rooms; 0: none is set up yet. */
  rooms: number;
}

export interface NewVisit {
  starts_at: string;
  note?: string;
  /** Text the customer the time and the address (default on). */
  sms?: boolean;
  colleague?: number | null;
  colleague_note?: string;
}

const VISITS_KEY = [...CALENDAR_KEY, 'visits'] as const;
const customerVisitsKey = (id: number) => [...customerKey(id), 'visits'] as const;

/** A week of the office's meeting hours with how many rooms are free in each. */
export const visitSlotsQuery = (week: Date) => {
  const from = toValue(week, false);
  const to = toValue(new Date(week.getFullYear(), week.getMonth(), week.getDate() + 6), false);
  return queryOptions({
    queryKey: [...VISITS_KEY, from],
    queryFn: ({ signal }) =>
      api<VisitSlots>(
        `${SALES_API}/visits/slots/?${new URLSearchParams({ from, to }).toString()}`,
        { signal },
      ),
    staleTime: 30_000,
  });
};

/** The customer's next meeting at the office: read when the meeting window opens. */
export const customerVisitsQuery = (customer: number) =>
  queryOptions({
    queryKey: customerVisitsKey(customer),
    queryFn: ({ signal }) =>
      api<CustomerVisits>(`${SALES_API}/customers/${String(customer)}/visits/`, { signal }),
  });

/** Not awaited: the window's own callbacks (close, toast) run before the reloads swap its content. */
function useRefresh(customer: number) {
  const client = useQueryClient();
  return () =>
    void Promise.all([
      client.invalidateQueries({ queryKey: CALENDAR_KEY }),
      client.invalidateQueries({ queryKey: customerKey(customer) }),
    ]);
}

export function useBookVisit(customer: number) {
  const refresh = useRefresh(customer);
  return useMutation({
    mutationFn: (body: NewVisit) =>
      api<OfficeVisit>(`${SALES_API}/customers/${String(customer)}/visits/`, {
        method: 'POST',
        body,
      }),
    onSettled: refresh,
  });
}

export function useCancelVisit(customer: number) {
  const refresh = useRefresh(customer);
  return useMutation({
    mutationFn: (id: number) => api(`${SALES_API}/visits/${String(id)}/`, { method: 'DELETE' }),
    onSettled: refresh,
  });
}
