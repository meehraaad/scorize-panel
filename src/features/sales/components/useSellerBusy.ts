import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TASK_COLOR, TASK_MINUTES } from '@/components/tasks/CalendarSlots';
import type { CalendarEvent } from '@/components/ui/EventCalendar';
import { eventColor } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { sellerCalendarQuery, type SellerCalendar } from '../api';
import { callMinutes } from '../consultationStatus';

const DEFAULT_MINUTES = 30;

/**
 * The seller's own week as blocks (their sessions, office meetings and follow-up calls), for
 * picking a time around them: the office meeting window.
 */
export function useSellerBusy(week: Date): { busy: CalendarEvent[]; isPending: boolean } {
  const blocks = useSellerBlocks();
  const { data, isPending } = useQuery(sellerCalendarQuery(week));
  return { busy: blocks(data), isPending };
}

/** The blocks of a week of the seller's calendar (the follow-up picker reads its own week). */
export function useSellerBlocks(): (data: SellerCalendar | undefined) => CalendarEvent[] {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const f = useFormat();
  return (data) => {
    const types = new Map((data?.types ?? []).map((type) => [type.id, type]));
    return [
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
            aria: `${named(item.name)}، ${f.time(start)}`,
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
            aria: `${named(item.name)}، ${f.time(start)}، ${t('visit.onCalendar')}`,
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
            minutes: callMinutes(item),
            color: 'var(--text-2)',
            look: 'call' as const,
            title: item.name,
            meta: f.time(start),
            aria: `${named(item.name)}، ${f.time(start)}، ${t('consultationCalendar.followUp')}`,
          };
        }),
    ];
  };
}
