import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { toValue } from '@/lib/calendar';
import type { CalendarTaskDay } from '../api';
import { salesPath } from '../paths';

/**
 * A day's tasks on the calendar's day row, in brief: how many are left (late on a past day), the
 * colleagues' requests among them and how many are done. There's no room to list them: it links
 * to the tasks page, on the list they are in, showing only that day.
 */
export function TaskBrief({
  day,
  tasks,
  today,
  compact,
}: {
  day: Date;
  tasks: CalendarTaskDay | undefined;
  today: Date;
  compact: boolean;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  if (!tasks) return null;
  const open = tasks.mine + tasks.requests;
  if (open === 0 && tasks.done === 0) return null;
  const late = open > 0 && day < today;
  const isToday = day.getTime() === today.getTime();
  const tone =
    open === 0
      ? 'bg-good-tint text-good'
      : late
        ? 'bg-warn-tint text-warn'
        : isToday
          ? 'bg-tint text-primary-text'
          : 'bg-canvas text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)]';
  const headline =
    open === 0
      ? t('consultationCalendar.tasks.allDone')
      : t(late ? 'consultationCalendar.tasks.late' : 'consultationCalendar.tasks.open', {
          n: f.number(open),
        });
  const aria = t('consultationCalendar.tasks.aria', {
    day: f.weekday(day),
    parts: [
      tasks.mine > 0 && t('consultationCalendar.tasks.ariaMine', { n: f.number(tasks.mine) }),
      tasks.requests > 0 &&
        t('consultationCalendar.tasks.requests', { n: f.number(tasks.requests) }),
      tasks.done > 0 && t('consultationCalendar.tasks.done', { n: f.number(tasks.done) }),
    ]
      .filter(Boolean)
      .join('، '),
  });
  // Only colleagues' requests left: open that list; otherwise my follow-ups.
  const view = tasks.mine === 0 && tasks.requests > 0 ? 'requests' : 'mine';

  return (
    <Link
      to={`${salesPath('tasks')}?${new URLSearchParams({ view, day: toValue(day, false) }).toString()}`}
      aria-label={aria}
      title={aria}
      className={`flex min-h-11 min-w-0 flex-col justify-center gap-0.5 rounded-lg px-2 py-1 text-xs font-bold hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${tone} ${
        compact ? 'items-center px-1' : ''
      }`}
    >
      <span className="flex min-w-0 items-center gap-1">
        <Icon name="check" size={12} className="flex-none" />
        <span className="truncate">{compact ? f.number(open || tasks.done) : headline}</span>
      </span>
      {!compact && (tasks.requests > 0 || (open > 0 && tasks.done > 0)) && (
        <span className="truncate text-[11px] font-semibold opacity-80">
          {[
            tasks.requests > 0 &&
              t('consultationCalendar.tasks.requests', { n: f.number(tasks.requests) }),
            open > 0 &&
              tasks.done > 0 &&
              t('consultationCalendar.tasks.done', { n: f.number(tasks.done) }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </Link>
  );
}
