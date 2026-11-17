import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGroup } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import type { CalendarEvent } from '@/components/ui/EventCalendar';
import { Icon } from '@/components/ui/Icon';
import { Switch } from '@/components/ui/Switch';
import { WeekNav } from '@/components/ui/WeekNav';
import { addDays, parseValue, sameDay, toValue, weekOf, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { FOLLOWS, followAtOf, type Follow } from '../followUp';
import { useSellerBusy } from './useSellerBusy';

/** The hours offered on a day (a follow-up call), the first at 9:00 and the last at 20:00. */
const FIRST_HOUR = 9;
const LAST_HOUR = 20;
/** A day picked with no hour keeps a morning time, so turning the hour back on starts there. */
const DAY_HOUR = 10;
/** How far ahead the week can go (as the office meeting window). */
const WEEKS_AHEAD = 8;
const MINUTE = 60_000;

export interface FollowChange {
  follow?: Follow;
  date?: string;
  dateOnly?: boolean;
}

/**
 * When to follow up, the same everywhere a seller sets one (the contact log, the follow-up window):
 * a few quick times, a day with no hour, or a day and hour on the seller's own week (the day strip,
 * then the hours, where their sessions and calls show). `calendar="toggle"` keeps the week folded
 * behind «از تقویم» (the contact log, already long); `open` shows it. The exact time field stays
 * the keyboard way to type any time.
 */
export function FollowUpWhen({
  follow,
  date,
  dateOnly = false,
  onChange,
  legend,
  hideLegend = true,
  calendar = 'toggle',
}: {
  follow: Follow;
  /** `YYYY-MM-DDTHH:mm`, read when `follow` is `other`. */
  date: string;
  dateOnly?: boolean | undefined;
  onChange: (change: FollowChange) => void;
  legend: string;
  hideLegend?: boolean;
  calendar?: 'toggle' | 'open';
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [unfolded, setUnfolded] = useState(false);
  const shown = calendar === 'open' || unfolded;
  const followAt = followAtOf(follow, date, dateOnly);
  const picked = follow === 'other' && followAt !== null;
  const pick = (value: string) => {
    onChange({ follow: 'other', date: value });
    if (calendar === 'toggle') setUnfolded(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <ChoiceGroup
        legend={legend}
        hideLegend={hideLegend}
        value={follow === 'other' ? null : follow}
        onChange={(value) => {
          onChange({ follow: value });
          setUnfolded(false);
        }}
        options={FOLLOWS.map((value) => ({
          value,
          label: t(
            dateOnly
              ? `customer.logDialog.followDayOption.${value}`
              : `customer.logDialog.followOption.${value}`,
          ),
        }))}
        extra={
          calendar === 'toggle' && (
            <button
              type="button"
              onClick={() => setUnfolded(!unfolded)}
              aria-expanded={unfolded}
              className={`inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                picked
                  ? 'bg-hero text-on-hero'
                  : 'text-primary-text shadow-[inset_0_0_0_1px_var(--primary)] hover:bg-tint'
              }`}
            >
              <Icon name="calendar" size={16} />
              {picked
                ? dateOnly
                  ? t('customer.logDialog.followWhenDay', { day: f.weekdayName(followAt) })
                  : t('customer.logDialog.followWhen', {
                      day: f.weekdayName(followAt),
                      time: f.time(followAt),
                    })
                : unfolded
                  ? t('customer.logDialog.closeCalendar')
                  : t('customer.logDialog.fromCalendar')}
            </button>
          )
        }
      />
      <Switch
        label={t('whenPicker.dateOnly')}
        description={t('whenPicker.dateOnlyHint')}
        checked={dateOnly}
        onChange={(checked) => onChange({ dateOnly: checked })}
      />
      {shown && (
        <WhenWeek value={follow === 'other' ? date : ''} dateOnly={dateOnly} onPick={pick} />
      )}
    </div>
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
 * The seller's week as a day strip and the picked day's hours, each with what the seller already
 * has then. Without an hour (`dateOnly`) a tap on a day picks it.
 */
function WhenWeek({
  value,
  dateOnly,
  onPick,
}: {
  /** `YYYY-MM-DDTHH:mm`; '' before a pick. */
  value: string;
  dateOnly: boolean;
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
  const [week, setWeek] = useState(() => weekOf(picked ?? now, startDay));
  const [shownDay, setShownDay] = useState(() => picked ?? today);
  const { busy } = useSellerBusy(week);
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const day = days.find((item) => sameDay(item, shownDay)) ?? days.find((item) => item >= today);
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
          const past = item < today;
          const on = dateOnly ? !!picked && sameDay(item, picked) : !!day && sameDay(item, day);
          return (
            <button
              key={item.getTime()}
              type="button"
              disabled={past}
              aria-pressed={on}
              aria-label={f.weekday(item)}
              onClick={() => {
                setShownDay(item);
                if (dateOnly) {
                  const at = new Date(item);
                  at.setHours(DAY_HOUR, 0, 0, 0);
                  onPick(toValue(at, true));
                }
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
      {dateOnly ? (
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
              const on = !!picked && picked.getTime() === start.getTime();
              return (
                <button
                  key={start.getTime()}
                  type="button"
                  disabled={start < now || taken}
                  aria-pressed={on}
                  title={
                    mine ? `${t(`whenPicker.kind.${kind ?? 'call'}`)}: ${mine.title}` : undefined
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
            value={value}
            onChange={onPick}
          />
        </>
      )}
    </div>
  );
}
