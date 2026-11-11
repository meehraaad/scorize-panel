import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@/components/ui/EventCalendar';
import { eventColor } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { sellerCalendarQuery } from '../api';

const CALL_MINUTES = 15;
const DEFAULT_MINUTES = 30;
/** A task with an hour is drawn this long, in its own colour. */
export const TASK_MINUTES = 30;
export const TASK_COLOR = 'var(--cal-5)';

/**
 * The seller's own week as blocks (their sessions, office meetings and follow-up calls), for
 * picking a time around them: the follow-up picker and the office meeting window.
 */
export function useSellerBusy(week: Date): { busy: CalendarEvent[]; isPending: boolean } {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data, isPending } = useQuery(sellerCalendarQuery(week));
  const types = new Map((data?.types ?? []).map((type) => [type.id, type]));

  const busy: CalendarEvent[] = [
    ...(data?.consultations ?? [])
      .filter((item) => item.mine)
      .map((item) => {
        const start = new Date(item.starts_at);
        return {
          id: `c${String(item.id)}`,
          start,
          minutes: item.minutes ?? DEFAULT_MINUTES,
          color: eventColor(types.get(item.type)?.color),
          look: 'upcoming' as const,
          title: item.name,
          meta: f.time(start),
          aria: `${item.name}، ${f.time(start)}`,
        };
      }),
    ...(data?.visits ?? [])
      .filter((item) => item.mine)
      .map((item) => {
        const start = new Date(item.starts_at);
        return {
          id: `v${String(item.id)}`,
          start,
          minutes: item.minutes,
          color: 'var(--cal-7)',
          look: 'upcoming' as const,
          title: item.name,
          meta: f.time(start),
          aria: `${item.name}، ${f.time(start)}، ${t('visit.onCalendar')}`,
        };
      }),
    ...(data?.task_rows ?? [])
      .filter((item) => item.timed && !item.done)
      .map((item) => {
        const start = new Date(item.due_at);
        return {
          id: `t${String(item.id)}`,
          start,
          minutes: TASK_MINUTES,
          color: TASK_COLOR,
          look: 'call' as const,
          title: item.text,
          meta: [f.time(start), item.name].filter(Boolean).join(' · '),
          aria: [item.text, item.name, f.time(start), t('consultationCalendar.taskBlock')]
            .filter(Boolean)
            .join('، '),
        };
      }),
    ...(data?.calls ?? [])
      .filter((item) => item.timed !== false)
      .map((item) => {
        const start = new Date(item.follow_up_at);
        return {
          id: `l${String(item.lead)}`,
          start,
          minutes: CALL_MINUTES,
          color: 'var(--text-2)',
          look: 'call' as const,
          title: item.name,
          meta: f.time(start),
          aria: `${item.name}، ${f.time(start)}، ${t('consultationCalendar.followUp')}`,
        };
      }),
  ];
  return { busy, isPending };
}
