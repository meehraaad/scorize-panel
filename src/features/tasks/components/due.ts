import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';

const DAY = 86_400_000;

/**
 * When a task is due, as its list shows it: its hour, "all day" for a day-only task, or how many
 * days late once it is more than a day overdue (an hour today still reads better than "1 day").
 */
export function useDueLabel() {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  return (task: { due_at: string; timed?: boolean | undefined }, now: number) => {
    const overdue = now - new Date(task.due_at).getTime();
    const late = overdue > 0;
    const text =
      late && overdue >= DAY
        ? t('mine.daysLate', { n: f.number(Math.floor(overdue / DAY)) })
        : task.timed === false
          ? t('mine.allDay')
          : f.time(task.due_at);
    return { late, text };
  };
}
