import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskCalendar, type DayMark } from '@/components/tasks/TaskCalendar';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { calendarQuery, HR_KEY, type HrEventKind } from './api';
import { EVENT_COLOR } from './format';
import { hrPath, personPath } from './paths';

const KINDS: readonly HrEventKind[] = ['entry', 'exit', 'trial_end', 'contract_end', 'birthday'];

/**
 * HR's calendar (canvas "تقویم منابع انسانی"): my tasks on the week (`TaskCalendar`) and above each
 * day what HR keeps an eye on (first and last days, trials and contracts ending, birthdays), each
 * linking to the person.
 */
export default function CalendarPage() {
  const { t } = useTranslation('hr');
  const cal = useCalendar();
  const [now] = useState(() => new Date());
  const thisWeek = weekOf(now, weekStart(cal.kind));
  const [week, setWeek] = useState(thisWeek);
  const { data, isPending } = useQuery(calendarQuery(week));
  const client = useQueryClient();

  const marksOf = (day: string): DayMark[] =>
    (data?.events ?? [])
      .filter((event) => event.day === day)
      .map((event) => ({
        id: event.id,
        color: EVENT_COLOR[event.kind],
        text: t(`calendar.short.${event.kind}`, { name: event.staff.name }),
        title: `${t(`calendar.kind.${event.kind}`)} · ${event.staff.name}`,
        to: personPath(event.staff.id),
      }));

  return (
    <PageStack>
      <PageHeader title={t('calendar.title')} subtitle={t('calendar.subtitle')} />
      <TaskCalendar
        label={t('calendar.title')}
        dayRowLabel={t('calendar.dayRow')}
        week={week}
        thisWeek={thisWeek}
        onWeekChange={setWeek}
        now={now}
        data={data}
        loading={isPending}
        panel="hr"
        tasksPath={hrPath('tasks')}
        legend={KINDS.map((kind) => ({
          key: kind,
          color: EVENT_COLOR[kind],
          label: t(`calendar.kind.${kind}`),
        }))}
        marksOf={marksOf}
        onCreated={() => void client.invalidateQueries({ queryKey: [...HR_KEY, 'calendar'] })}
      />
    </PageStack>
  );
}
