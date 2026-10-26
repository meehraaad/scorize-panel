import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  addMonths,
  fromCalendar,
  monthGrid,
  parseValue,
  sameDay,
  toCalendar,
  toValue,
  weekStart,
  type CalendarDay,
} from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { Icon } from './Icon';

interface DatePickerProps {
  label: string;
  /** `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` with `time`; '' when empty (the native input formats). */
  value: string;
  onChange: (value: string) => void;
  /** Also pick a time (hour and minutes, in `minuteStep` steps). */
  time?: boolean;
  minuteStep?: number;
  /** Earliest / latest selectable day, as a value string. */
  min?: string | undefined;
  max?: string | undefined;
  /** Only days from today on (follow-ups, deadlines) or up to today (birth dates). */
  only?: 'future' | 'past';
  hint?: string | undefined;
  error?: string | undefined;
  /** Show a button that empties the field. */
  clearable?: boolean;
  placeholder?: string;
}

type View = 'days' | 'months' | 'years';
const YEARS_PER_PAGE = 12;
const DEFAULT_HOUR = 10;

/**
 * A date field with its own calendar, in the user's calendar (Jalali in Persian, with Persian
 * digits and Saturday-first weeks; Gregorian in English) instead of the browser's picker, which is
 * Gregorian only. A field button opens a calendar card (a bottom sheet on phones) with month and
 * year views, today, an optional time, and full keyboard use (arrows, PageUp/PageDown, Home/End).
 */
export function DatePicker({
  label,
  value,
  onChange,
  time = false,
  minuteStep = 5,
  min,
  max,
  only,
  hint,
  error,
  clearable = false,
  placeholder,
}: DatePickerProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);
  const message = error ?? hint;

  const shown = selected
    ? time
      ? `${f.weekday(selected)} · ${f.time(selected)}`
      : f.date(selected)
    : (placeholder ?? (time ? t('datePicker.chooseTime') : t('datePicker.choose')));

  const show = () => {
    setOpen(true);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <div className="flex flex-col gap-2">
      <label id={`${id}-label`} htmlFor={id} className="text-sm font-semibold text-text-2">
        {label}
      </label>
      <div className="relative flex items-center">
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-labelledby={`${id}-label ${id}-value`}
          aria-describedby={message ? `${id}-message` : undefined}
          aria-invalid={error ? true : undefined}
          onClick={show}
          className={`flex h-12 w-full items-center gap-3 rounded-2xl bg-surface ps-4 text-start text-base shadow-[inset_0_0_0_1px_var(--line-2)] outline-none hover:shadow-[inset_0_0_0_1px_var(--line-3)] focus-visible:shadow-[inset_0_0_0_2px_var(--focus)] aria-invalid:shadow-[inset_0_0_0_1.5px_var(--danger)] ${clearable && selected ? 'pe-14' : 'pe-4'}`}
        >
          <span className="text-text-2">
            <Icon name="calendar" size={20} />
          </span>
          <span
            id={`${id}-value`}
            className={`flex-1 truncate ${selected ? 'text-text' : 'text-text-3'}`}
          >
            {shown}
          </span>
        </button>
        {clearable && selected && (
          <button
            type="button"
            aria-label={t('datePicker.clearLabel', { label })}
            onClick={() => onChange('')}
            className="absolute end-1 flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-canvas"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      {message && (
        <p
          id={`${id}-message`}
          className={`m-0 text-sm leading-6 ${error ? 'text-danger' : 'text-text-2'}`}
        >
          {message}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-label={label}
        onClose={() => setOpen(false)}
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-card bg-surface p-0 text-text shadow-hero backdrop:bg-black/40 sm:m-auto sm:w-[360px] sm:rounded-card"
      >
        {open && (
          <Calendar
            label={label}
            selected={selected}
            time={time}
            minuteStep={minuteStep}
            min={parseValue(min ?? '')}
            max={parseValue(max ?? '')}
            only={only}
            onPick={(date) => {
              onChange(toValue(date, time));
              close();
            }}
            onClose={close}
          />
        )}
      </dialog>
    </div>
  );
}

function Calendar({
  label,
  selected,
  time,
  minuteStep,
  min,
  max,
  only,
  onPick,
  onClose,
}: {
  label: string;
  selected: Date | null;
  time: boolean;
  minuteStep: number;
  min: Date | null;
  max: Date | null;
  only: 'future' | 'past' | undefined;
  onPick: (date: Date) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const cal = useCalendar();
  const grid = useRef<HTMLDivElement>(null);
  const [now] = useState(() => new Date());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = only === 'future' && (!min || min < today) ? today : min;
  const until = only === 'past' && (!max || max > today) ? today : max;
  const start = selected ?? (from && from > today ? from : until && until < today ? until : today);
  // The day the keyboard is on, and the month on screen.
  const [focus, setFocus] = useState(start);
  const [month, setMonth] = useState<CalendarDay>(() => toCalendar(start, cal.kind));
  const [view, setView] = useState<View>('days');
  const [day, setDay] = useState<Date | null>(selected);
  const [hour, setHour] = useState(selected ? selected.getHours() : DEFAULT_HOUR);
  const [minute, setMinute] = useState(
    selected ? selected.getMinutes() - (selected.getMinutes() % minuteStep) : 0,
  );
  // Starts true: opening the calendar puts the focus on the selected day (or today).
  const [moved, setMoved] = useState(true);

  const allowed = (date: Date) =>
    (!from || date >= new Date(from.getFullYear(), from.getMonth(), from.getDate())) &&
    (!until || date <= new Date(until.getFullYear(), until.getMonth(), until.getDate()));

  // On open, and after a key moved the focus: put it on that day's button.
  useEffect(() => {
    if (!moved) return;
    grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }, [focus, moved]);

  const go = (date: Date) => {
    setFocus(date);
    setMoved(true);
    const target = toCalendar(date, cal.kind);
    if (target.year !== month.year || target.month !== month.month) setMonth(target);
  };

  const choose = (date: Date) => {
    if (!allowed(date)) return;
    if (!time) {
      onPick(date);
      return;
    }
    setDay(date);
    setFocus(date);
  };

  const onKey = (event: KeyboardEvent) => {
    const forward = cal.rtl ? -1 : 1;
    const startDay = weekStart(cal.kind);
    const keys: Record<string, () => Date> = {
      ArrowRight: () => addDays(focus, forward),
      ArrowLeft: () => addDays(focus, -forward),
      ArrowDown: () => addDays(focus, 7),
      ArrowUp: () => addDays(focus, -7),
      Home: () => addDays(focus, -((focus.getDay() - startDay + 7) % 7)),
      End: () => addDays(focus, 6 - ((focus.getDay() - startDay + 7) % 7)),
      PageDown: () =>
        fromCalendar(
          addMonths(toCalendar(focus, cal.kind), event.shiftKey ? 12 : 1, cal.kind),
          cal.kind,
        ),
      PageUp: () =>
        fromCalendar(
          addMonths(toCalendar(focus, cal.kind), event.shiftKey ? -12 : -1, cal.kind),
          cal.kind,
        ),
    };
    const next = keys[event.key];
    if (!next) return;
    event.preventDefault();
    go(next());
  };

  const weeks = monthGrid(month.year, month.month, cal.kind);
  const firstOfMonth = fromCalendar({ ...month, day: 1 }, cal.kind);
  const title = `${cal.month.format(firstOfMonth)} ${cal.year.format(firstOfMonth)}`;
  const pickedDay = time ? day : selected;
  const heading = pickedDay ? f.weekday(pickedDay) : t('datePicker.choose');
  const step = (months: number) => setMonth(addMonths(month, months, cal.kind));

  return (
    <div className="flex flex-col pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-start justify-between gap-3 bg-tint px-5 pt-5 pb-4 sm:rounded-t-card">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-primary-text">{label}</span>
          <span className="font-display text-xl font-bold">
            {heading}
            {time && pickedDay && (
              <span className="ms-2 text-base font-semibold text-text-2">
                {`${cal.twoDigits.format(hour)}:${cal.twoDigits.format(minute)}`}
              </span>
            )}
          </span>
          {cal.kind === 'persian' && pickedDay && (
            // The same day in the Gregorian calendar (universities' deadlines), kept left to right.
            <span className="text-xs text-text-2">{`\u2066${f.gregorian(pickedDay) ?? ''}\u2069`}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('datePicker.close')}
          className="-me-2 flex size-11 flex-none items-center justify-center rounded-full text-text-2 hover:bg-surface"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <NavButton
          icon="chevronStart"
          label={
            view === 'days'
              ? t('datePicker.previousMonth')
              : view === 'months'
                ? t('datePicker.previousYear')
                : t('datePicker.previousYears')
          }
          onClick={() =>
            step(view === 'days' ? -1 : view === 'months' ? -12 : -12 * YEARS_PER_PAGE)
          }
        />
        <button
          type="button"
          aria-label={view === 'days' ? t('datePicker.pickMonth') : t('datePicker.pickYear')}
          aria-expanded={view !== 'days'}
          onClick={() => setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'days')}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-4 text-base font-bold hover:bg-canvas"
        >
          {view === 'days' ? title : cal.year.format(firstOfMonth)}
          <Icon name="chevronDown" size={16} className={view === 'days' ? '' : 'rotate-180'} />
        </button>
        <NavButton
          icon="chevronEnd"
          label={
            view === 'days'
              ? t('datePicker.nextMonth')
              : view === 'months'
                ? t('datePicker.nextYear')
                : t('datePicker.nextYears')
          }
          onClick={() => step(view === 'days' ? 1 : view === 'months' ? 12 : 12 * YEARS_PER_PAGE)}
        />
      </div>

      {view === 'days' && (
        <div
          ref={grid}
          role="grid"
          aria-label={title}
          onKeyDown={onKey}
          className="flex flex-col gap-1 px-3 pt-2 pb-3"
        >
          <div role="row" className="grid grid-cols-7">
            {weeks[0]?.map((date) => (
              <span
                key={date.getDay()}
                role="columnheader"
                aria-label={cal.weekdayLong.format(date)}
                className={`flex h-8 items-center justify-center text-xs font-semibold ${cal.kind === 'persian' && date.getDay() === 5 ? 'text-danger' : 'text-text-2'}`}
              >
                {cal.weekday.format(date)}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0]?.toDateString()} role="row" className="grid grid-cols-7">
              {week.map((date) => {
                const inMonth = toCalendar(date, cal.kind).month === month.month;
                const isSelected = pickedDay !== null && sameDay(date, pickedDay);
                const isToday = sameDay(date, today);
                const enabled = allowed(date);
                const friday = cal.kind === 'persian' && date.getDay() === 5;
                return (
                  <span
                    key={date.toDateString()}
                    role="gridcell"
                    aria-selected={isSelected}
                    className="flex items-center justify-center"
                  >
                    <button
                      type="button"
                      tabIndex={sameDay(date, focus) ? 0 : -1}
                      aria-label={f.date(date)}
                      aria-current={isToday ? 'date' : undefined}
                      aria-disabled={!enabled || undefined}
                      onClick={() => choose(date)}
                      className={`flex size-11 items-center justify-center rounded-full text-[15px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${
                        isSelected
                          ? 'bg-primary font-bold text-on-primary'
                          : !enabled
                            ? 'cursor-not-allowed text-text-3 opacity-60'
                            : `hover:bg-tint ${isToday ? 'font-bold text-primary-text shadow-[inset_0_0_0_1.5px_var(--primary)]' : ''} ${
                                !inMonth ? 'text-text-3' : friday ? 'text-danger' : 'text-text'
                              }`
                      }`}
                    >
                      {cal.number.format(toCalendar(date, cal.kind).day)}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {view === 'months' && (
        <ChoiceGrid
          items={Array.from({ length: 12 }, (_, index) => {
            const date = fromCalendar({ year: month.year, month: index + 1, day: 1 }, cal.kind);
            return {
              key: String(index),
              label: cal.month.format(date),
              current: index + 1 === month.month,
              onClick: () => {
                setMonth(addMonths({ ...month, month: 1 }, index, cal.kind));
                setView('days');
              },
            };
          })}
        />
      )}

      {view === 'years' && (
        <ChoiceGrid
          items={Array.from({ length: YEARS_PER_PAGE }, (_, index) => {
            const year = month.year - (month.year % YEARS_PER_PAGE) + index;
            const date = fromCalendar({ year, month: 1, day: 1 }, cal.kind);
            return {
              key: String(year),
              label: cal.year.format(date),
              current: year === month.year,
              onClick: () => {
                setMonth({ ...month, year, day: 1 });
                setView('months');
              },
            };
          })}
        />
      )}

      {time && view === 'days' && (
        <fieldset className="m-0 flex items-center justify-between gap-3 border-0 px-5 pt-1 pb-3 shadow-[inset_0_1px_0_var(--hair)]">
          <legend className="sr-only">{t('datePicker.time')}</legend>
          <span className="flex items-center gap-2 pt-3 text-sm font-semibold text-text-2">
            <Icon name="clock" size={18} />
            {t('datePicker.time')}
          </span>
          <span dir="ltr" className="flex items-center gap-1.5 pt-3">
            <TimeSelect
              label={t('datePicker.hour')}
              value={hour}
              onChange={setHour}
              options={Array.from({ length: 24 }, (_, index) => index)}
              format={(n) => cal.twoDigits.format(n)}
            />
            <span className="font-bold text-text-2">:</span>
            <TimeSelect
              label={t('datePicker.minute')}
              value={minute}
              onChange={setMinute}
              options={Array.from(
                { length: Math.ceil(60 / minuteStep) },
                (_, index) => index * minuteStep,
              )}
              format={(n) => cal.twoDigits.format(n)}
            />
          </span>
        </fieldset>
      )}

      <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-4 shadow-[inset_0_1px_0_var(--hair)]">
        <button
          type="button"
          disabled={!allowed(today)}
          onClick={() => {
            setView('days');
            go(today);
            choose(today);
          }}
          className="min-h-11 rounded-full px-4 text-sm font-semibold text-primary-text hover:bg-tint disabled:opacity-40"
        >
          {t('datePicker.today')}
        </button>
        {time && (
          <button
            type="button"
            disabled={!day}
            onClick={() => {
              if (!day) return;
              onPick(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute));
            }}
            className="min-h-11 rounded-full bg-primary px-6 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-40"
          >
            {t('datePicker.done')}
          </button>
        )}
      </div>
    </div>
  );
}

function NavButton({
  icon,
  label,
  onClick,
}: {
  icon: 'chevronStart' | 'chevronEnd';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full text-text hover:bg-canvas"
    >
      <Icon name={icon} />
    </button>
  );
}

/** Months or years as a 3-column grid of buttons. */
function ChoiceGrid({
  items,
}: {
  items: { key: string; label: ReactNode; current: boolean; onClick: () => void }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 pt-3 pb-4">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.current}
          onClick={item.onClick}
          className="min-h-12 rounded-2xl text-sm font-semibold hover:bg-tint aria-pressed:bg-primary aria-pressed:text-on-primary"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function TimeSelect({
  label,
  value,
  onChange,
  options,
  format,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  options: number[];
  format: (value: number) => string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-11 appearance-none rounded-xl bg-canvas px-3 text-center text-base font-semibold tabular-nums shadow-[inset_0_0_0_1px_var(--line-2)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {format(option)}
        </option>
      ))}
    </select>
  );
}
