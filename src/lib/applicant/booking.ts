import { queryOptions } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ApiError, api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { useBookConsultation } from '@/lib/applicant/journey';
import { addDays, toValue } from '@/lib/calendar';
import { toast } from '@/lib/toast';
import { safeHref } from '@/lib/url';

/**
 * The booking calendar (H66): every consultation one can book, and their times in a range of days,
 * full ones too. Booking itself is H64 (`useBookConsultation`). Shapes: docs/backend-changes.md.
 */

export type ConsultationMode = 'online' | 'in_person';
export const CONSULTATION_MODES: readonly ConsultationMode[] = ['online', 'in_person'];

export interface BookableType {
  id: number;
  title: string;
  description: string | null;
  mode: ConsultationMode;
  minutes: number;
  /** Toman, after a running discount. */
  price: number;
  /** Toman before the discount, while there is one. */
  full_price: number | null;
  /** Google Calendar colour id (1–11); null: the brand's. */
  color: string | null;
  /** Booked most in its mode lately. */
  popular: boolean;
}

export interface CalendarSlot {
  type: number;
  at: string;
  /** Seats left; 0: full. */
  left: number;
  capacity: number;
}

export interface BookingCalendar {
  types: BookableType[];
  slots: CalendarSlot[];
}

/** The API's longest range, in days (`to` - `from`). */
export const CALENDAR_MAX_DAYS = 62;
/** Days one read covers: eight weeks. */
export const CALENDAR_READ_DAYS = 55;

const CALENDAR_KEY = [...APPLICANT_KEY, 'calendar'] as const;

/** `from`: the first day (`YYYY-MM-DD`); the read covers CALENDAR_READ_DAYS more. */
export const calendarQuery = (from: string) => {
  const [year, month, day] = from.split('-').map(Number);
  const to = toValue(new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) + CALENDAR_READ_DAYS), false);
  return queryOptions({
    queryKey: [...CALENDAR_KEY, from],
    queryFn: ({ signal }) =>
      api<BookingCalendar>(
        `/applicant/v1/consultations/calendar/?${new URLSearchParams({ from, to }).toString()}`,
        { signal },
      ),
    // Seats change as people book: fresh enough for a visit.
    staleTime: 60_000,
  });
};

/** The first day of the week holding `date` (`startDay`: 0–6 as `Date.getDay`, `weekStart`). */
export function weekOf(date: Date, startDay: number) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(day, -((day.getDay() - startDay + 7) % 7));
}

/** The booking page's first read: from the week holding today, CALENDAR_READ_DAYS days. */
export const firstCalendarQuery = (startDay: number, now = new Date()) =>
  calendarQuery(toValue(weekOf(now, startDay), false));

/** The CSS colour of a type: its Google Calendar colour as a theme token. */
export const typeColor = (type: Pick<BookableType, 'color'>) =>
  `var(--cal-${type.color && /^(?:[1-9]|1[01])$/.test(type.color) ? type.color : '0'})`;

/**
 * Books a consultation at a time: off to the bank gateway, or straight to the session when credit
 * pays it. A time taken meanwhile says so (the times are read again).
 */
export function useBookSlot(messages: { booked: string; taken: string; error: string }) {
  const navigate = useNavigate();
  const book = useBookConsultation();
  const submit = (type: number, startsAt: string) =>
    book.mutate(
      { type, starts_at: startsAt },
      {
        onSuccess: ({ consultation, redirect_url }) => {
          const target = safeHref(redirect_url);
          if (target) window.location.assign(target);
          else {
            toast.success(messages.booked);
            void navigate(`/consultations/${String(consultation)}`);
          }
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 400 ? messages.taken : messages.error,
          ),
      },
    );
  return { submit, pending: book.isPending };
}
