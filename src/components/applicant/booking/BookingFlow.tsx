import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useId, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { MiniMonth } from '@/components/ui/MiniMonth';
import { WeekCalendar } from '@/components/ui/WeekCalendar';
import {
  CALENDAR_READ_DAYS,
  CONSULTATION_MODES,
  calendarQuery,
  firstCalendarQuery,
  typeColor,
  useBookSlot,
  type BookableType,
  type CalendarSlot,
  type ConsultationMode,
  weekOf,
} from '@/lib/applicant/booking';
import { addDays, sameDay, toValue, weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';

/** How far ahead one may look, in weeks after this one. */
const WEEKS_AHEAD = 11;

/**
 * Booking a consultation like a calendar app (design: "Consultation Booking Design" canvas): first
 * online or in person, then the topic (every bookable type, the most booked marked; the list
 * scrolls so the month stays in view), then a time on the week calendar, where full and nearly
 * full times show too. Picking a time opens its card with the price and "book and pay". The
 * booking page and the booking dialog both show it; `initial` opens it on a choice.
 */
export function BookingFlow({
  initial,
}: {
  initial?: { mode?: string | null | undefined; type?: number | undefined } | undefined;
}) {
  const { t } = useTranslation('booking');
  const cal = useCalendar();
  const startDay = weekStart(cal.kind);
  const [now] = useState(() => new Date());
  const firstWeek = weekOf(now, startDay);
  const lastWeek = addDays(firstWeek, WEEKS_AHEAD * 7);
  const { data } = useSuspenseQuery(firstCalendarQuery(startDay, now));
  const [week, setWeek] = useState(firstWeek);
  // Weeks past the first read come with their own.
  const beyond = addDays(week, 6) > addDays(firstWeek, CALENDAR_READ_DAYS);
  const later = useQuery({ ...calendarQuery(toValue(week, false)), enabled: beyond });
  // The opener's choice, then the person's.
  const [choice, setChoice] = useState(() => ({
    mode: initial?.mode ?? null,
    type: initial?.type ?? 0,
  }));
  const [pick, setPick] = useState<string | null>(null);

  const { types } = data;
  const slots = mergeSlots(data.slots, beyond ? (later.data?.slots ?? []) : []);
  const modes = CONSULTATION_MODES.filter((mode) => types.some((type) => type.mode === mode));
  const asked = choice.mode;
  const mode: ConsultationMode | undefined = modes.find((item) => item === asked) ?? modes[0];
  const ofMode = types.filter((type) => type.mode === mode);
  const askedType = choice.type;
  const type =
    ofMode.find((item) => item.id === askedType) ??
    ofMode.find((item) => item.popular) ??
    ofMode[0];

  // A type's first week with a free time (or this week).
  const firstFreeWeek = (id: number) => {
    const free = slots
      .filter((slot) => slot.type === id && slot.left > 0)
      .map((slot) => new Date(slot.at))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return free ? weekOf(free, startDay) : firstWeek;
  };
  const choose = (next: { mode: ConsultationMode; type: number }) => {
    setChoice(next);
    setPick(null);
    setWeek(firstFreeWeek(next.type));
  };

  if (!type || !mode)
    return (
      <EmptyState
        variant="card"
        icon="calendar"
        title={t('none')}
        action={
          <CallRequestButton
            label={t('call')}
            className={buttonClass('primary')}
            phone={null}
            topic="admission"
            page="consultations"
            reason="guest"
          />
        }
      >
        {t('noneText')}
      </EmptyState>
    );

  const times = slots.filter((slot) => slot.type === type.id);
  const chosen = pick ? times.find((slot) => slot.at === pick && slot.left > 0) : undefined;
  const color = typeColor(type);

  return (
    <div className="flex flex-wrap items-start gap-4 lg:gap-6">
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 lg:max-w-80">
        <ModeChoice
          modes={modes}
          mode={mode}
          onChange={(next) => {
            const list = types.filter((item) => item.mode === next);
            const first = list.find((item) => item.popular) ?? list[0];
            if (first) choose({ mode: next, type: first.id });
          }}
        />
        <TypeChoice
          mode={mode}
          types={ofMode}
          type={type}
          onChange={(id) => choose({ mode, type: id })}
        />
        <Card className="p-3 max-lg:hidden">
          <MiniMonth
            week={week}
            color={color}
            min={now}
            max={addDays(lastWeek, 6)}
            marked={(date) =>
              times.some((slot) => slot.left > 0 && sameDay(new Date(slot.at), date))
            }
            onPick={(date) => {
              setWeek(weekOf(date, startDay));
              setPick(null);
            }}
          />
        </Card>
      </div>

      <Card className="min-w-0 flex-[999_1_560px] p-4 lg:p-5">
        <WeekCalendar
          label={t('calendar', { title: type.title })}
          week={week}
          onWeekChange={(next) => {
            setWeek(next);
            setPick(null);
          }}
          firstWeek={firstWeek}
          lastWeek={lastWeek}
          times={times}
          minutes={type.minutes}
          color={color}
          value={chosen?.at ?? null}
          onChange={setPick}
          loading={beyond && later.isPending}
          details={chosen && <SlotCard type={type} slot={chosen} onClose={() => setPick(null)} />}
          empty={
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-5 text-center shadow-[0_12px_32px_rgb(27_16_32/0.12)]">
              <span className="text-sm font-semibold">{t('emptyWeek')}</span>
              {week < lastWeek && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const next = firstFreeWeek(type.id);
                    setWeek(next > week ? next : addDays(week, 7));
                  }}
                >
                  {t('nextFree')}
                </Button>
              )}
            </div>
          }
          now={now}
        />
      </Card>
    </div>
  );
}

/** Both reads' times, the later read's winning where they meet. */
function mergeSlots(first: CalendarSlot[], later: CalendarSlot[]) {
  if (!later.length) return first;
  const key = (slot: CalendarSlot) => `${String(slot.type)} ${slot.at}`;
  const seen = new Set(later.map(key));
  return [...first.filter((slot) => !seen.has(key(slot))), ...later];
}

function ModeChoice({
  modes,
  mode,
  onChange,
}: {
  modes: ConsultationMode[];
  mode: ConsultationMode;
  onChange: (mode: ConsultationMode) => void;
}) {
  const { t } = useTranslation('booking');
  const name = useId();
  return (
    <Card className="p-4">
      <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
        <legend className="mb-3 flex items-center gap-2 p-0 text-sm font-bold">
          <Step n={1} />
          {t('how')}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {modes.map((item) => (
            <label
              key={item}
              className="group flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)] has-checked:bg-row-highlight has-checked:text-primary-text has-checked:shadow-[inset_0_0_0_2px_var(--primary)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
            >
              <input
                type="radio"
                name={name}
                value={item}
                checked={item === mode}
                onChange={() => onChange(item)}
                className="sr-only"
              />
              <Icon name={item === 'online' ? 'video' : 'building'} size={19} />
              {t(`modes.${item}.title`)}
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}

function TypeChoice({
  mode,
  types,
  type,
  onChange,
}: {
  mode: ConsultationMode;
  types: BookableType[];
  type: BookableType;
  onChange: (id: number) => void;
}) {
  const { t } = useTranslation('booking');
  const f = useFormat();
  const name = useId();
  return (
    <Card className="p-4">
      <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
        <legend className="mb-3 flex items-center gap-2 p-0 text-sm font-bold">
          <Step n={2} />
          {t(`topics.${mode}`)}
        </legend>
        <div className="-me-2 flex max-h-64 flex-col gap-1 overflow-y-auto pe-2">
          {types.map((item) => {
            const on = item.id === type.id;
            return (
              <label
                key={item.id}
                style={{ '--event': typeColor(item) } as CSSProperties}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-canvas has-checked:bg-[color-mix(in_srgb,var(--event)_12%,var(--surface))] has-focus-visible:outline-2 has-focus-visible:outline-focus"
              >
                <input
                  type="radio"
                  name={name}
                  value={item.id}
                  checked={on}
                  onChange={() => onChange(item.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex size-5 flex-none items-center justify-center rounded-md text-on-primary ${
                    on ? 'bg-[var(--event)]' : 'shadow-[inset_0_0_0_2px_var(--event)]'
                  }`}
                >
                  {on && <Icon name="check" size={13} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                    {item.title}
                    {item.popular && (
                      <span className="rounded-full bg-warn-tint px-2 text-[11px] font-bold text-warn">
                        {t('popular')}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-text-2">
                    {t('typeLine', {
                      minutes: f.number(item.minutes),
                      price: t('toman', { amount: f.number(item.price) }),
                    })}
                    {item.full_price !== null && (
                      <s className="ms-1.5">{t('toman', { amount: f.number(item.full_price) })}</s>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </Card>
  );
}

function Step({ n }: { n: number }) {
  const f = useFormat();
  return (
    <span
      aria-hidden="true"
      className="flex size-6 items-center justify-center rounded-full bg-tint text-xs font-bold text-primary-text"
    >
      {f.number(n)}
    </span>
  );
}

/** The chosen time's card, beside it on the calendar: what, when, how, the price, "book and pay". */
function SlotCard({
  type,
  slot,
  onClose,
}: {
  type: BookableType;
  slot: CalendarSlot;
  onClose: () => void;
}) {
  const { t } = useTranslation('booking');
  const f = useFormat();
  const book = useBookSlot({
    booked: t('booked'),
    taken: t('taken'),
    error: t('error'),
  });
  const start = new Date(slot.at);
  const end = new Date(start.getTime() + type.minutes * 60_000);
  const toman = (amount: number) => t('toman', { amount: f.number(amount) });
  return (
    <section
      role="dialog"
      aria-label={t('card', { title: type.title })}
      className="flex flex-col gap-4 rounded-card-sm bg-surface p-5 shadow-[0_0_0_1px_var(--hair),0_24px_48px_rgb(27_16_32/0.22)]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1.5 size-4 flex-none rounded-[5px]"
          style={{ background: typeColor(type) }}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-base leading-7 font-bold">{type.title}</span>
          <span className="text-sm">
            {t('when', { day: f.weekday(start), from: f.time(start), to: f.time(end) })}
          </span>
          {f.gregorian(start) && (
            // The same day in the Gregorian calendar, kept left to right.
            <span className="text-xs text-text-2">{`\u2066${f.gregorian(start) ?? ''}\u2069`}</span>
          )}
        </span>
        <IconButton icon="close" aria-label={t('close')} onClick={onClose} />
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px] text-text-2">
        <li className="flex items-center gap-2.5">
          <Icon name={type.mode === 'online' ? 'video' : 'building'} size={18} />
          {t(`modes.${type.mode}.detail`, { minutes: f.number(type.minutes) })}
        </li>
        <li className="flex items-center gap-2.5">
          <Icon name="card" size={18} />
          <span className="font-bold text-text">{toman(type.price)}</span>
          {type.full_price !== null && <s>{toman(type.full_price)}</s>}
        </li>
        {slot.capacity > 1 && slot.left < slot.capacity && (
          <li className="flex items-center gap-2.5 font-bold text-warn">
            <Icon name="user" size={18} />
            {slot.left === 1
              ? t('lastSeat')
              : t('seatsLeft', { n: f.number(slot.left), of: f.number(slot.capacity) })}
          </li>
        )}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {t('another')}
        </Button>
        <Button disabled={book.pending} onClick={() => book.submit(type.id, slot.at)}>
          {t('pay')}
        </Button>
      </div>
    </section>
  );
}

export default BookingFlow;
