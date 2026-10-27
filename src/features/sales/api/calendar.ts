import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toValue } from '@/lib/calendar';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';

/** A consultation type on the seller's calendar: its colour and how it is held. */
export interface CalendarType {
  id: number;
  name: string;
  mode: 'online' | 'in_person';
  /** Google Calendar colour id (1–11); null: the brand's. */
  color: string | null;
}

export interface CalendarConsultation {
  id: number;
  customer: number;
  name: string;
  phone: string;
  type: number;
  mode: 'online' | 'in_person';
  minutes: number | null;
  starts_at: string;
  /** The session has its contact log. */
  logged: boolean;
  /** The customer filled the tablet form. */
  form: boolean;
  /** In person: when the customer arrived; null before. */
  arrived_at: string | null;
}

/** An open lead with a follow-up time in the range. */
export interface CalendarCall {
  lead: number;
  customer: number;
  name: string;
  phone: string;
  reason: string;
  follow_up_at: string;
}

export interface SellerCalendar {
  types: CalendarType[];
  consultations: CalendarConsultation[];
  calls: CalendarCall[];
}

const CALENDAR_KEY = [...SALES_KEY, 'calendar'] as const;

/** A week of the seller's consultations and timed follow-ups (S47), from its first day. */
export const sellerCalendarQuery = (week: Date) => {
  const from = toValue(week, false);
  const to = toValue(new Date(week.getFullYear(), week.getMonth(), week.getDate() + 6), false);
  return queryOptions({
    queryKey: [...CALENDAR_KEY, from],
    queryFn: ({ signal }) =>
      api<SellerCalendar>(
        `${SALES_API}/consultations/calendar/?${new URLSearchParams({ from, to }).toString()}`,
        { signal },
      ),
    staleTime: 60_000,
  });
};

/** An in-person customer arrived at the office (S47). */
export function useMarkArrived() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ arrived_at: string }>(`${SALES_API}/consultations/${String(id)}/arrived/`, {
        method: 'POST',
      }),
    onSettled: () => client.invalidateQueries({ queryKey: CALENDAR_KEY }),
  });
}
