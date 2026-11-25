import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';

const DAY = 86_400_000;

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/**
 * When a task is due, as its list shows it: its hour, "all day" for a day-only task, or how many
 * days late once it is more than a day overdue (an hour today still reads better than "1 day").
 * Due on a later day: that day too ("27 Azar, 10:00"), so a request ahead never reads as today's.
 */
export function useDueLabel() {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  return (task: { due_at: string; timed?: boolean | undefined }, now: number) => {
    const due = new Date(task.due_at);
    const overdue = now - due.getTime();
    const late = overdue > 0;
    const later = !late && !sameDay(due, new Date(now));
    const text =
      late && overdue >= DAY
        ? t('mine.daysLate', { n: f.number(Math.floor(overdue / DAY)) })
        : later
          ? task.timed === false
            ? f.dateShort(task.due_at)
            : t('mine.dayAndTime', { day: f.dateShort(task.due_at), time: f.time(task.due_at) })
          : task.timed === false
            ? t('mine.allDay')
            : f.time(task.due_at);
    return { late, text };
  };
}
