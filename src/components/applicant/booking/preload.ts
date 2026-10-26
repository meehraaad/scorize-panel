import { queryClient } from '@/lib/api/queryClient';
import { firstCalendarQuery } from '@/lib/applicant/booking';
import { weekStart } from '@/lib/calendar';
import i18n from '@/lib/i18n';
import { calendarKind } from '@/lib/i18n/useCalendar';

/** Starts the booking dialog's code and its first read (pointer over, or focus on, an opener). */
export function preloadBooking() {
  void import('./BookingFlow');
  queryClient
    .query(firstCalendarQuery(weekStart(calendarKind(i18n.language))))
    .catch(() => undefined);
}
