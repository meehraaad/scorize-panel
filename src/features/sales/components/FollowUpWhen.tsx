import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGroup } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import type { CalendarEvent } from '@/components/ui/EventCalendar';
import { Icon } from '@/components/ui/Icon';
import { Dialog } from '@/components/ui/Dialog';
import { WeekNav } from '@/components/ui/WeekNav';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { addDays, parseValue, sameDay, toValue, weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { FOLLOWS, followAtOf, followOnOf, isDayOnly, type Follow } from '../followUp';
import { FollowUpSlots } from './FollowUpSlots';
import { useSellerBusy } from './useSellerBusy';

/** The hours offered on a day, the first at 9:00 and the last at 20:00. */
const FIRST_HOUR = 9;
const LAST_HOUR = 20;
/** How far ahead the week can go (as the office meeting window). */
const WEEKS_AHEAD = 8;
const MINUTE = 60_000;

/**
 * When to follow up, the same everywhere a seller sets one: a few quick times, «از تقویم» (a day
 * and hour on the seller's week) and «فقط روز، بدون ساعت» (a day with no hour, `dayFollowUps`:
 * `date` is then `YYYY-MM-DD`). `calendar="inline"` (the contact and session log) opens the week
 * in the form: a day strip, then that day's hours with the seller's own sessions, meetings, calls
 * and tasks; for a day only, the strip alone. `dialog` (the follow-up window) opens the seller's
 * full week calendar in a window, or a day picker. The exact time field stays the keyboard way.
 */
export function FollowUpWhen({
  follow,
  date,
  onChange,
  name = '',
  legend,
  hideLegend = true,
  calendar = 'inline',
}: {
  follow: Follow;
  /** `YYYY-MM-DDTHH:mm`, or `YYYY-MM-DD` for a day with no hour; read when `follow` is `other`. */
  date: string;
  onChange: (change: { follow: Follow; date?: string }) => void;
  /** The customer, named in the calendar window's title (`dialog`). */
  name?: string;
  legend: string;
  hideLegend?: boolean;
  calendar?: 'inline' | 'dialog';
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  /** Which picker is open: the week and a time, or only a day. */
  const [picking, setPicking] = useState<'time' | 'day' | null>(null);
  const followAt = followAtOf(follow, date);
  const followOn = followOnOf(follow, date);
  const followDay = followOn ? parseValue(followOn) : null;
  const inline = calendar === 'inline';
  const pick = (value: string) => {
    onChange({ follow: 'other', date: value });
    setPicking(null);
  };
  const toggle = (mode: 'time' | 'day') => setPicking(picking === mode ? null : mode);
  const chip = (mode: 'time' | 'day') => (inline ? { expanded: picking === mode } : {});

  return (
    <div className="flex flex-col gap-3">
      <ChoiceGroup
        legend={legend}
        hideLegend={hideLegend}
        value={follow === 'other' ? null : follow}
        onChange={(value) => {
          setPicking(null);
          onChange({ follow: value });
        }}
        options={FOLLOWS.map((value) => ({
          value,
          label: t(`customer.logDialog.followOption.${value}`),
        }))}
        extra={
          <>
            <PickChip
              on={follow === 'other' && followAt !== null}
              onClick={() => toggle('time')}
              {...chip('time')}
            >
              <Icon name="calendar" size={16} />
              {follow === 'other' && followAt
                ? t('customer.logDialog.followWhen', {
                    day: f.weekdayName(followAt),
                    time: f.time(followAt),
                  })
                : t('customer.logDialog.fromCalendar')}
            </PickChip>
            {ON_SERVER.dayFollowUps && (
              <PickChip on={followDay !== null} onClick={() => toggle('day')} {...chip('day')}>
                {followDay
                  ? t('customer.logDialog.followDay', { day: f.weekday(followDay) })
                  : t('followUpWhen.dayChip')}
              </PickChip>
            )}
          </>
        }
      />
      {inline && picking && (
        <WhenWeek
          key={picking}
          value={follow === 'other' ? date : ''}
          dayOnly={picking === 'day'}
          onPick={pick}
        />
      )}
      {!inline && (
        <Dialog
          open={picking !== null}
          onClose={() => setPicking(null)}
          {...(picking === 'time' ? { size: 'wide' as const } : {})}
          title={t('customer.logDialog.calendarTitle', { name })}
          subtitle={t(
            picking === 'day' ? 'followUpWhen.dayHint' : 'customer.logDialog.calendarHint',
          )}
          closeLabel={t('close')}
        >
          {picking && (
            <div className="flex flex-col gap-4">
              {picking === 'time' ? (
                <>
                  <FollowUpSlots
                    value={followAt && follow === 'other' ? date : ''}
                    onChange={pick}
                  />
                  <DatePicker
                    time
                    only="future"
                    minuteStep={15}
                    label={t('followUpWhen.exact')}
                    value={followAt && follow === 'other' ? date : ''}
                    onChange={pick}
                  />
                </>
              ) : (
                <DatePicker
                  only="future"
                  label={t('followUpWhen.day')}
                  value={followOn ?? ''}
                  onChange={pick}
                />
              )}
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}

/**
 * A chip beside the quick times that opens a picker; filled once something is picked there.
 * Inline it unfolds the week below (`expanded`); else it opens a window (pressed when picked).
 */
function PickChip({
  on,
  expanded,
  onClick,
  children,
}: {
  on: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(expanded === undefined ? { 'aria-pressed': on } : { 'aria-expanded': expanded })}
      className={`inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
        on
          ? 'bg-hero text-on-hero'
          : 'text-primary-text shadow-[inset_0_0_0_1px_var(--primary)] hover:bg-tint'
      }`}
    >
      {children}
    </button>
  );
}

type Kind = 'session' | 'visit' | 'task' | 'call';

/** What a block of the seller's week is, by its id (useSellerBusy: c, v, t, l). */
const kindOf = (event: CalendarEvent): Kind =>
  event.id.startsWith('c')
    ? 'session'
    : event.id.startsWith('v')
      ? 'visit'
      : event.id.startsWith('t')
        ? 'task'
        : 'call';

/** A session or an office meeting takes the seller's hour; a call or a task only shows on it. */
const blocks = (kind: Kind) => kind === 'session' || kind === 'visit';

/**
 * The seller's week as a day strip and the shown day's hours, each with what the seller already
 * has then. Without an hour (`dayOnly`) a tap on a day picks it.
 */
function WhenWeek({
  value,
  dayOnly,
  onPick,
}: {
  /** `YYYY-MM-DDTHH:mm` or `YYYY-MM-DD`; '' before a pick. */
  value: string;
  dayOnly: boolean;
  onPick: (value: string) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const cal = useCalendar();
  const startDay = weekStart(cal.kind);
  const [now] = useState(() => new Date());
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const thisWeek = weekOf(now, startDay);
  const picked = parseValue(value);
  const pickedTime = picked && !isDayOnly(value) ? picked : null;
  const [week, setWeek] = useState(() => weekOf(picked ?? now, startDay));
  const [shownDay, setShownDay] = useState(() => picked ?? today);
  const { busy } = useSellerBusy(week);
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const day =
    days.find((item) => sameDay(item, shownDay)) ??
    days.find((item) => item.getTime() >= today.getTime());
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, index) => {
    const start = new Date(day ?? today);
    start.setHours(FIRST_HOUR + index, 0, 0, 0);
    const end = start.getTime() + 60 * MINUTE;
    const mine = busy.find((event) => {
      const begins = event.start.getTime();
      return begins < end && begins + event.minutes * MINUTE > start.getTime();
    });
    return { start, mine, kind: mine ? kindOf(mine) : null };
  });

  const toWeek = (next: Date) => {
    setWeek(next);
    setShownDay(next < today ? today : next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-card-sm bg-canvas p-3">
      <WeekNav
        week={week}
        onWeekChange={toWeek}
        thisWeek={thisWeek}
        min={thisWeek}
        max={addDays(thisWeek, 7 * WEEKS_AHEAD)}
        large={false}
      />
      <div role="group" aria-label={t('whenPicker.days')} className="grid grid-cols-7 gap-1.5">
        {days.map((item) => {
          const past = item.getTime() < today.getTime();
          const on = dayOnly
            ? !!picked && isDayOnly(value) && sameDay(item, picked)
            : !!day && sameDay(item, day);
          return (
            <button
              key={item.getTime()}
              type="button"
              disabled={past}
              aria-pressed={on}
              aria-label={f.weekday(item)}
              onClick={() => {
                setShownDay(item);
                if (dayOnly) onPick(toValue(item, false));
              }}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-text-2 disabled:opacity-60 ${
                on
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface shadow-[inset_0_0_0_1px_var(--hair)] enabled:hover:bg-tint'
              }`}
            >
              <span className="text-xs">{cal.weekday.format(item)}</span>
              <span className="text-base font-bold">{f.dayMonth(item).day}</span>
            </button>
          );
        })}
      </div>
      {dayOnly ? (
        <p className="m-0 text-xs leading-5 text-text-2">{t('whenPicker.dayHint')}</p>
      ) : (
        <>
          <div
            role="group"
            aria-label={t('whenPicker.hours')}
            className="grid grid-cols-4 gap-1.5 sm:grid-cols-6"
          >
            {hours.map(({ start, mine, kind }) => {
              const taken = kind !== null && blocks(kind);
              const on = !!pickedTime && pickedTime.getTime() === start.getTime();
              return (
                <button
                  key={start.getTime()}
                  type="button"
                  disabled={start < now || taken}
                  aria-pressed={on}
                  title={
                    mine && kind ? `${t(`whenPicker.kind.${kind}`)}: ${mine.title}` : undefined
                  }
                  onClick={() => onPick(toValue(start, true))}
                  className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl px-1 text-sm leading-tight font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed ${
                    on
                      ? 'bg-hero text-on-hero'
                      : taken
                        ? 'bg-track text-text-2'
                        : 'bg-surface shadow-[inset_0_0_0_1px_var(--line-2)] enabled:hover:bg-tint disabled:opacity-50'
                  }`}
                >
                  <span>{f.time(start)}</span>
                  {kind && (
                    <span className="max-w-full truncate text-[11px] font-medium">
                      {t(`whenPicker.kind.${kind}`)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="m-0 text-xs leading-5 text-text-2">{t('whenPicker.hint')}</p>
          <DatePicker
            time
            only="future"
            minuteStep={15}
            label={t('followUpWhen.exact')}
            value={pickedTime ? value : ''}
            onChange={onPick}
          />
        </>
      )}
    </div>
  );
}
