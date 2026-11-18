import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskCalendar, type DayMark } from '@/components/tasks/TaskCalendar';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { MARKETING_KEY, calendarQuery, type MarketingEventKind } from './api';
import { EVENT_COLOR } from './format';
import { marketingPath } from './paths';

const KINDS: readonly MarketingEventKind[] = ['campaign_start', 'campaign_end'];

/**
 * The marketing calendar: my tasks on the week (`TaskCalendar`) and above each day the campaigns
 * starting or ending. The board's publish dates join in phase 2.
 */
export default function CalendarPage() {
  const { t } = useTranslation('marketing');
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
        text: t(`calendar.short.${event.kind}`, { title: event.title }),
        title: `${t(`calendar.kind.${event.kind}`)} · ${event.title}`,
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
        panel="marketing"
        tasksPath={marketingPath('tasks')}
        legend={KINDS.map((kind) => ({
          key: kind,
          color: EVENT_COLOR[kind],
          label: t(`calendar.kind.${kind}`),
        }))}
        marksOf={marksOf}
        onCreated={() =>
          void client.invalidateQueries({ queryKey: [...MARKETING_KEY, 'calendar'] })
        }
      />
    </PageStack>
  );
}
