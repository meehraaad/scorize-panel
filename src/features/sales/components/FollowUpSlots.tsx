import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventCalendar } from '@/components/ui/EventCalendar';
import { WeekNav } from '@/components/ui/WeekNav';
import { addDays, parseValue, toValue, weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useSellerBusy } from './useSellerBusy';

const CALL_MINUTES = 15;
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
  const { busy, isPending } = useSellerBusy(week);
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
