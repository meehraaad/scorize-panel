import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventCalendar, type CalendarEvent } from '@/components/ui/EventCalendar';
import { WeekNav } from '@/components/ui/WeekNav';
import { addDays, eventColor, parseValue, toValue, weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { sellerCalendarQuery } from '../api';

const CALL_MINUTES = 15;
const DEFAULT_MINUTES = 30;
const PICKED = 'picked';

/**
 * Picking a follow-up time on the seller's own week (the calendar's schedule): their sessions and
 * follow-up calls show, and a tap on a free spot picks that time. Beside a time field, which stays
 * the keyboard way to type one.
 */
export function FollowUpSlots({
  value,
  onChange,
}: {
  /** `YYYY-MM-DDTHH:mm` (the time field's value); '' before a pick. */
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const cal = useCalendar();
  const startDay = weekStart(cal.kind);
  const [now] = useState(() => new Date());
  const thisWeek = weekOf(now, startDay);
  const picked = parseValue(value);
  const [week, setWeek] = useState(() => weekOf(picked ?? now, startDay));
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
    ...(data?.calls ?? []).map((item) => {
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
  const events = picked
    ? [
        ...busy,
        {
          id: PICKED,
          start: picked,
          minutes: CALL_MINUTES,
          color: 'var(--primary)',
          look: 'live' as const,
          title: t('followUpSlots.picked'),
          meta: f.time(picked),
          aria: t('followUpSlots.pickedAria', { day: f.weekday(picked), time: f.time(picked) }),
        },
      ]
    : busy;

  return (
    <div className="flex flex-col gap-2">
      <WeekNav
        week={week}
        onWeekChange={setWeek}
        thisWeek={thisWeek}
        min={thisWeek}
        max={addDays(thisWeek, 7 * 8)}
        large={false}
      />
      <p className="m-0 text-xs text-text-2">{t('followUpSlots.hint')}</p>
      <EventCalendar
        label={t('followUpSlots.label')}
        week={week}
        events={events}
        value={picked ? PICKED : null}
        // Choosing a block only shows it: the time is picked on a free spot.
        onChange={() => undefined}
        loading={isPending}
        now={now}
        hourHeight={44}
        narrowHourHeight={52}
        onSlotPick={(start) => {
          if (start.getTime() < Date.now()) toast.error(t('followUpDialog.past'));
          else onChange(toValue(start, true));
        }}
      />
    </div>
  );
}
