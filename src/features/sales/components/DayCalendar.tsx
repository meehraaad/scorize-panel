import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import type { CallItem, TodayConsultation } from '../api';
import { customerPath, salesPath } from '../paths';
import { useNow } from '../useNow';

const MINUTE = 60_000;
/** Height of one hour on the grid, in px. */
const HOUR = 64;
/** The working day shown even when it is empty; events outside it widen the grid. */
const DAY_START = 8;
const DAY_END = 20;
/** Consultation types without a length, and follow-up calls, get a block this long. */
const DEFAULT_MINUTES = 30;
const CALL_MINUTES = 15;
/** Blocks shorter than this still fit a name. */
const MIN_BLOCK = 28;
/** Below this height a block has one line (name and time); above it, the type and status too. */
const ROOMY_BLOCK = 60;

type Status = 'live' | 'need' | 'done' | 'upcoming';

type Event =
  | { kind: 'consultation'; start: number; end: number; item: TodayConsultation }
  | { kind: 'call'; start: number; end: number; item: CallItem };

/** Side-by-side columns for events that overlap, like a calendar app's day view. */
function layOut(events: Event[]) {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: { event: Event; lane: number; lanes: number }[] = [];
  let group: { event: Event; lane: number; lanes: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const entry of group) entry.lanes = laneEnds.length;
    placed.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const event of sorted) {
    if (event.start >= groupEnd) close();
    let lane = laneEnds.findIndex((end) => end <= event.start);
    if (lane === -1) lane = laneEnds.push(event.end) - 1;
    else laneEnds[lane] = event.end;
    group.push({ event, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, event.end);
  }
  close();
  return placed;
}

const statusOf = (event: Event & { kind: 'consultation' }, now: number): Status => {
  if (event.item.logged) return 'done';
  if (event.start <= now && now < event.end) return 'live';
  return event.start <= now ? 'need' : 'upcoming';
};

const BLOCK: Record<Status | 'call', string> = {
  live: 'bg-primary text-on-primary',
  need: 'bg-warn-tint text-text border-s-[3px] border-warn',
  done: 'bg-good-tint text-text border-s-[3px] border-good',
  upcoming: 'bg-tint text-text border-s-[3px] border-primary',
  call: 'bg-surface text-text shadow-[inset_0_0_0_1px_var(--line-2)]',
};

/**
 * Today as a calendar day: consultations as blocks as long as the session, follow-up calls with a
 * time as short blocks, and a line at the current time. Overlaps sit side by side.
 */
export function DayCalendar({
  consultations,
  calls,
}: {
  consultations: TodayConsultation[];
  calls: CallItem[];
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const now = useNow(MINUTE);
  const scroller = useRef<HTMLDivElement>(null);

  const events: Event[] = [
    ...consultations.map((item) => {
      const start = new Date(item.starts_at).getTime();
      return {
        kind: 'consultation' as const,
        start,
        end: start + (item.minutes ?? DEFAULT_MINUTES) * MINUTE,
        item,
      };
    }),
    ...calls
      .filter((item) => item.bucket === 'today' && item.follow_up_at)
      .map((item) => {
        const start = new Date(item.follow_up_at ?? '').getTime();
        return { kind: 'call' as const, start, end: start + CALL_MINUTES * MINUTE, item };
      }),
  ];

  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const hourOf = (time: number) => (time - midnight.getTime()) / (60 * MINUTE);
  const first = Math.min(DAY_START, ...events.map((event) => Math.floor(hourOf(event.start))));
  const last = Math.max(DAY_END, ...events.map((event) => Math.ceil(hourOf(event.end))));
  const startHour = Math.max(0, first);
  const endHour = Math.min(24, last);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const top = (time: number) => (hourOf(time) - startHour) * HOUR;
  const nowTop = top(now);
  const showNow = nowTop >= 0 && nowTop <= hours.length * HOUR;

  // Open on the hour before now (or the first event), like a calendar app.
  const firstEvent = Math.min(...events.map((event) => event.start));
  const anchor = showNow ? nowTop - HOUR : Number.isFinite(firstEvent) ? top(firstEvent) - 16 : 0;
  // Kept from the first render: later ticks of the clock must not move the user's scroll.
  const [initialAnchor] = useState(anchor);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, initialAnchor);
  }, [initialAnchor]);

  const range = (start: number, end: number) =>
    t('today.calendar.range', { from: f.time(new Date(start)), to: f.time(new Date(end)) });
  const hourLabel = (hour: number) => {
    const date = new Date(midnight);
    date.setHours(hour);
    return f.time(date);
  };

  const consultationCount = consultations.length;
  const callCount = events.length - consultationCount;
  const next = events
    .filter((event): event is Event & { kind: 'consultation' } => event.kind === 'consultation')
    .filter((event) => !event.item.logged && event.end > now)
    .sort((a, b) => a.start - b.start)[0];
  const unlogged = events.filter(
    (event) => event.kind === 'consultation' && statusOf(event, now) === 'need',
  ).length;

  return (
    <SectionCard
      id="day-calendar"
      className="flex min-h-0 flex-1 flex-col"
      title={t('today.calendar.title')}
      subtitle={t('today.calendar.subtitle', {
        day: f.weekday(new Date(now)),
        consultations: f.number(consultationCount),
        calls: f.number(callCount),
      })}
      end={
        <Link
          to={salesPath('leads/consultations')}
          className="text-sm font-medium text-primary-text"
        >
          {t('today.calendar.all')}
        </Link>
      }
    >
      {next && <NextUp event={next} now={now} range={range(next.start, next.end)} />}
      {unlogged > 0 && (
        <p className="m-0 mx-5 mb-3 flex items-center gap-2 text-sm text-warn lg:mx-8">
          <Icon name="alert" size={16} />
          {t('today.calendar.unlogged', { n: f.number(unlogged) })}
        </p>
      )}
      <div
        ref={scroller}
        className="relative max-h-[560px] min-h-0 flex-1 overflow-y-auto shadow-[inset_0_1px_0_var(--hair)] xl:max-h-none"
      >
        <div className="relative my-3" style={{ height: hours.length * HOUR }}>
          {hours.map((hour, index) => (
            <div
              key={hour}
              aria-hidden="true"
              className="absolute inset-x-0 flex"
              style={{ top: index * HOUR, height: HOUR }}
            >
              <span className="w-16 flex-none -translate-y-2 ps-5 text-xs text-text-2 tabular-nums lg:w-20 lg:ps-8">
                {hourLabel(hour)}
              </span>
              <span className="flex-1 shadow-[inset_0_1px_0_var(--hair)]" />
            </div>
          ))}

          {events.length === 0 && (
            <p className="absolute inset-x-0 top-1/3 m-0 px-5 text-center text-sm text-text-2">
              {t('today.calendar.empty')}
            </p>
          )}

          <ol className="absolute inset-y-0 start-16 end-3 m-0 list-none p-0 lg:start-20 lg:end-5">
            {layOut(events).map(({ event, lane, lanes }) => (
              <li
                key={`${event.kind}-${String(event.kind === 'call' ? event.item.lead : event.item.id)}`}
                className="absolute px-0.5"
                style={{
                  top: top(event.start),
                  height: Math.max(MIN_BLOCK, top(event.end) - top(event.start)),
                  insetInlineStart: `${String((lane / lanes) * 100)}%`,
                  width: `${String(100 / lanes)}%`,
                }}
              >
                {event.kind === 'consultation' ? (
                  <ConsultationBlock
                    event={event}
                    status={statusOf(event, now)}
                    range={range(event.start, event.end)}
                    roomy={top(event.end) - top(event.start) >= ROOMY_BLOCK}
                  />
                ) : (
                  <CallBlock event={event} />
                )}
              </li>
            ))}
          </ol>

          {showNow && (
            <div
              role="img"
              aria-label={t('today.calendar.now', { time: f.time(new Date(now)) })}
              className="pointer-events-none absolute start-14 end-0 flex items-center lg:start-[72px]"
              style={{ top: nowTop - 5 }}
            >
              <span className="size-2.5 flex-none rounded-full bg-danger" />
              <span className="h-0.5 flex-1 bg-danger" />
            </div>
          )}
        </div>
      </div>
      <Legend />
    </SectionCard>
  );
}

function ConsultationBlock({
  event,
  status,
  range,
  roomy,
}: {
  event: Event & { kind: 'consultation' };
  status: Status;
  range: string;
  roomy: boolean;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { item } = event;
  // A session that started and isn't logged opens the session log; the rest open the customer.
  const to =
    status === 'need' || status === 'live'
      ? customerPath(item.customer, 'meeting', item.id)
      : customerPath(item.customer);
  const meta = t('today.consultations.type', { type: item.type, mode: t(`mode.${item.mode}`) });
  return (
    <Link
      to={to}
      aria-label={t('today.calendar.consultation', {
        name: item.name,
        range,
        meta,
        status: t(`today.calendar.status.${status}`),
      })}
      className={`flex h-full overflow-hidden rounded-xl px-3 text-start hover:brightness-95 ${
        roomy ? 'flex-col py-1.5' : 'items-center gap-2'
      } ${BLOCK[status]}`}
    >
      {roomy ? (
        <>
          <span className="truncate text-sm leading-5 font-semibold">{item.name}</span>
          <span
            className={`truncate text-xs leading-5 ${status === 'live' ? 'text-on-primary' : 'text-text-2'}`}
          >
            {t('today.calendar.meta', { range, meta })}
          </span>
          <span
            className={`truncate text-xs leading-5 font-medium ${
              status === 'live'
                ? 'text-on-primary'
                : status === 'need'
                  ? 'text-warn'
                  : 'text-text-2'
            }`}
          >
            {t(`today.calendar.status.${status}`)}
          </span>
        </>
      ) : (
        <span className="truncate text-xs leading-5">
          <span className="font-semibold">{item.name}</span>{' '}
          <span className={status === 'live' ? 'text-on-primary' : 'text-text-2'}>
            {f.time(new Date(event.start))}
          </span>
        </span>
      )}
    </Link>
  );
}

function CallBlock({ event }: { event: Event & { kind: 'call' } }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { item } = event;
  const time = f.time(new Date(event.start));
  return (
    <Link
      to={customerPath(item.customer, 'call')}
      aria-label={t('today.calendar.call', { name: item.name, time })}
      className={`flex h-full items-center gap-1.5 overflow-hidden rounded-xl px-3 text-xs hover:shadow-[inset_0_0_0_1px_var(--line-3)] ${BLOCK.call}`}
    >
      <Icon name="phone" size={14} />
      <span className="truncate">{t('today.calendar.callBlock', { time, name: item.name })}</span>
    </Link>
  );
}

/** The next session to run: when, and the links to get ready or join. */
function NextUp({
  event,
  now,
  range,
}: {
  event: Event & { kind: 'consultation' };
  now: number;
  range: string;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { item } = event;
  const minutes = Math.round((event.start - now) / MINUTE);
  const when =
    minutes <= 0
      ? t('today.calendar.nextNow')
      : minutes < 60
        ? t('today.calendar.nextIn', { n: f.number(minutes) })
        : t('today.calendar.nextAt', { time: f.time(new Date(event.start)) });
  return (
    <div className="mx-5 mb-3 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-canvas p-4 lg:mx-8">
      <span className="flex size-11 flex-none items-center justify-center rounded-icon bg-tint text-primary-text">
        <Icon name="calendar" size={20} />
      </span>
      <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <span className="text-xs font-semibold text-primary-text">{when}</span>
        <span className="truncate text-[15px] font-semibold">{item.name}</span>
        <span className="truncate text-xs text-text-2">
          {t('today.calendar.meta', {
            range,
            meta: t('today.consultations.type', { type: item.type, mode: t(`mode.${item.mode}`) }),
          })}
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        {item.meeting_url && (
          <a
            href={safeHref(item.meeting_url)}
            target="_blank"
            rel="noreferrer"
            aria-label={t('today.calendar.joinName', { name: item.name })}
            className={buttonClass('primary', 'h-11 px-4 text-sm')}
          >
            {t('today.calendar.join')}
          </a>
        )}
        <Link
          to={customerPath(item.customer)}
          aria-label={t('today.consultations.prepareName', { name: item.name })}
          className={buttonClass('outline', 'h-11 px-4 text-sm')}
        >
          {t('today.consultations.prepare')}
        </Link>
      </span>
    </div>
  );
}

function Legend() {
  const { t } = useTranslation('sales');
  const keys = [
    { key: 'upcoming', swatch: 'bg-tint shadow-[inset_0_0_0_1px_var(--primary)]' },
    { key: 'need', swatch: 'bg-warn-tint shadow-[inset_0_0_0_1px_var(--warn)]' },
    { key: 'done', swatch: 'bg-good-tint shadow-[inset_0_0_0_1px_var(--good)]' },
    { key: 'call', swatch: 'bg-surface shadow-[inset_0_0_0_1px_var(--line-3)]' },
  ] as const;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 px-5 py-4 text-xs text-text-2 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
      {keys.map(({ key, swatch }) => (
        <li key={key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 rounded ${swatch}`} />
          {t(`today.calendar.legend.${key}`)}
        </li>
      ))}
    </ul>
  );
}
