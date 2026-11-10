import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { PageColumns } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SaveBar } from '@/components/ui/SaveBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  WEEKDAYS,
  officeHoursQuery,
  useSaveOfficeHours,
  type OfficeHoursState,
  type OpenHours,
  type Weekday,
} from '@/lib/sales/phoneCalls';
import { toast } from '@/lib/toast';
import { LineSwitch } from './LineSwitch';

/** Every quarter hour of the day, `HH:MM`. */
const TIMES = Array.from({ length: 96 }, (_, i) =>
  [Math.floor(i / 4), (i % 4) * 15].map((part) => String(part).padStart(2, '0')).join(':'),
);
/** The timeline shows 6:00 to midnight (earlier or later times sit at its edges). */
const FIRST_HOUR = 6;
const SCALE = [6, 9, 12, 15, 18, 21, 24];

/** A day's row while editing: off days keep their last times, so switching back on restores them. */
interface DayDraft extends OpenHours {
  on: boolean;
}
type Week = Record<Weekday, DayDraft>;

function draftOf(days: OpenHours[], fallback: OpenHours): Week {
  return Object.fromEntries(
    WEEKDAYS.map((day) => {
      const saved = days.find((row) => row.day === day);
      return [day, saved ? { ...saved, on: true } : { ...fallback, day, on: false }];
    }),
  ) as Week;
}

const daysOf = (week: Week): OpenHours[] =>
  WEEKDAYS.filter((day) => week[day].on).map((day) => ({
    day,
    open: week[day].open,
    close: week[day].close,
  }));

const badDays = (week: Week) =>
  new Set(WEEKDAYS.filter((day) => week[day].on && week[day].close <= week[day].open));

/** `HH:MM` as a share of the timeline, 0 to 100. */
function place(time: string) {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const share = ((hours + minutes / 60 - FIRST_HOUR) / (24 - FIRST_HOUR)) * 100;
  return Math.min(100, Math.max(0, share));
}

/**
 * The office phone line's hours (manager section): a week as a timeline (when callers reach the
 * menu, and inside it when they can dial a person's number), today's switch and closed days. The
 * office worker applies them to the PBX within seconds. Until the first save, the page shows the
 * PBX's own hours.
 */
export default function OfficeHoursPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useSuspenseQuery(officeHoursQuery);

  return (
    <>
      <PageHeader
        title={t('manager.hours.title')}
        subtitle={
          <>
            <span className="font-semibold text-text">
              {t(data.open_now ? 'manager.hours.openNow' : 'manager.hours.closedNow')}
            </span>
            {' · '}
            {data.saved && data.updated_at
              ? t('manager.hours.updated', {
                  name: data.updated_by ?? t('manager.hours.someone'),
                  time: f.dateTime(data.updated_at),
                })
              : t('manager.hours.notSaved')}
          </>
        }
      />
      <HoursForm data={data} />
    </>
  );
}

function HoursForm({ data }: { data: OfficeHoursState }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const save = useSaveOfficeHours();
  const initial = () => ({
    week: draftOf(data.week, { day: 'sat', open: '09:00', close: '18:00' }),
    direct: draftOf(data.direct, { day: 'sat', open: '11:30', close: '13:00' }),
    closed: data.closed_days,
  });
  const [week, setWeek] = useState(() => initial().week);
  const [direct, setDirect] = useState(() => initial().direct);
  const [closedDays, setClosedDays] = useState(data.closed_days);
  const [saved, setSaved] = useState(() =>
    JSON.stringify([daysOf(initial().week), daysOf(initial().direct), data.closed_days]),
  );
  const [picked, setPicked] = useState('');
  const [pickError, setPickError] = useState(false);
  // Errors show after a save attempt and clear as each row is fixed.
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [attempt, setAttempt] = useState(0);
  // After a refused save, move to the first field to fix (once its error is on the page).
  useEffect(() => {
    if (attempt > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempt]);

  const weekBad = badDays(week);
  const directBad = badDays(direct);
  const weekEmpty = daysOf(week).length === 0;
  const dirty = JSON.stringify([daysOf(week), daysOf(direct), closedDays]) !== saved;

  const addDay = () => {
    if (!picked) {
      setPickError(true);
      return;
    }
    setClosedDays((days) => [...new Set([...days, picked])].sort());
    setPicked('');
  };

  const reset = () => {
    const fresh = initial();
    setWeek(fresh.week);
    setDirect(fresh.direct);
    setClosedDays(fresh.closed);
    setTried(false);
  };

  const submit = () => {
    setTried(true);
    if (weekBad.size > 0 || directBad.size > 0 || weekEmpty) {
      setAttempt((n) => n + 1);
      return;
    }
    const body = { week: daysOf(week), direct: daysOf(direct), closed_days: closedDays };
    save.mutate(
      { ...body, force: data.force },
      {
        onSuccess: (state) => {
          setClosedDays(state.closed_days);
          setSaved(JSON.stringify([body.week, body.direct, state.closed_days]));
          setTried(false);
          toast.success(t('manager.hours.saved'));
        },
        onError: () => toast.error(t('error')),
      },
    );
  };

  return (
    <form
      ref={form}
      aria-label={t('manager.hours.formLabel')}
      className="flex flex-col gap-4 lg:gap-7"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <PageColumns
        asideLabel={t('manager.hours.today.title')}
        main={
          <SectionCard
            id="office-hours-week"
            title={t('manager.hours.week.title')}
            subtitle={t('manager.hours.week.subtitle')}
          >
            <Timeline
              week={week}
              direct={direct}
              onWeek={setWeek}
              onDirect={setDirect}
              weekBad={tried ? weekBad : new Set()}
              directBad={tried ? directBad : new Set()}
            />
            {tried && weekEmpty && (
              <p role="alert" className="m-0 px-5 pb-5 text-[13px] text-danger lg:px-8">
                {t('manager.hours.errors.empty')}
              </p>
            )}
          </SectionCard>
        }
        aside={
          <>
            <SectionCard
              id="office-hours-today"
              variant="panel"
              title={t('manager.hours.today.title')}
              subtitle={t('manager.hours.today.subtitle')}
            >
              <LineSwitch data={data} />
            </SectionCard>
            <SectionCard
              id="office-hours-closed"
              variant="panel"
              title={t('manager.hours.closedDays.title')}
              subtitle={t('manager.hours.closedDays.subtitle')}
            >
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1">
                  <LazyDatePicker
                    label={t('manager.hours.closedDays.pick')}
                    value={picked}
                    onChange={(value) => {
                      setPicked(value);
                      setPickError(false);
                    }}
                    only="future"
                    error={pickError ? t('manager.hours.closedDays.pickFirst') : undefined}
                  />
                </div>
                <Button variant="outline" onClick={addDay}>
                  {t('manager.hours.closedDays.add')}
                </Button>
              </div>
              {closedDays.length === 0 ? (
                <EmptyState>{t('manager.hours.closedDays.empty')}</EmptyState>
              ) : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {closedDays.map((day) => (
                    <li
                      key={day}
                      className="flex min-h-12 items-center justify-between gap-2 border-b border-line-2 last:border-b-0"
                    >
                      <span className="text-[15px] text-text">
                        {f.weekday(day)} {f.date(day)}
                      </span>
                      <IconButton
                        icon="trash"
                        tone="danger"
                        aria-label={t('manager.hours.closedDays.remove', { day: f.date(day) })}
                        onClick={() =>
                          setClosedDays((days) => days.filter((value) => value !== day))
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </>
        }
      />
      <SaveBar
        dirty={dirty}
        message={t(dirty ? 'manager.hours.unsaved' : 'manager.hours.allSaved')}
      >
        {dirty && (
          <Button variant="onLuxe" onClick={reset}>
            {t('manager.hours.undo')}
          </Button>
        )}
        <Button type="submit" variant={dirty ? 'outline' : 'primary'} disabled={save.isPending}>
          {t('manager.hours.save')}
        </Button>
      </SaveBar>
    </form>
  );
}

/**
 * The week, a row per day: its switch, a bar for when callers reach the menu with a thin bar for
 * direct-number hours inside it, and an editor that opens under the row.
 */
function Timeline({
  week,
  direct,
  onWeek,
  onDirect,
  weekBad,
  directBad,
}: {
  week: Week;
  direct: Week;
  onWeek: (week: Week) => void;
  onDirect: (week: Week) => void;
  weekBad: Set<Weekday>;
  directBad: Set<Weekday>;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [open, setOpen] = useState<Set<Weekday>>(new Set());
  const options = TIMES.map((value) => ({ value, label: f.digits(value) }));
  const setDay = (day: Weekday, change: Partial<DayDraft>) =>
    onWeek({ ...week, [day]: { ...week[day], ...change } });
  const setDirectDay = (day: Weekday, change: Partial<DayDraft>) =>
    onDirect({ ...direct, [day]: { ...direct[day], ...change } });
  const toggle = (day: Weekday) =>
    setOpen((days) => {
      const next = new Set(days);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  /** This day's hours (both kinds) for every open day. */
  const copyToAll = (from: Weekday) => {
    const nextWeek = { ...week };
    const nextDirect = { ...direct };
    for (const day of WEEKDAYS) {
      if (!week[day].on || day === from) continue;
      nextWeek[day] = { ...week[day], open: week[from].open, close: week[from].close };
      nextDirect[day] = { ...direct[from], day };
    }
    onWeek(nextWeek);
    onDirect(nextDirect);
    toast.success(t('manager.hours.copied', { day: t(`manager.hours.day.${from}`) }));
  };

  return (
    <div className="flex flex-col px-5 pb-5 lg:px-8 lg:pb-7">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pb-3 text-[13px] text-text-2">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-4 rounded bg-tint ring-1 ring-primary/40" />
          {t('manager.hours.legend.week')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-4 rounded bg-primary" />
          {t('manager.hours.legend.direct')}
        </span>
      </div>
      <div aria-hidden="true" className="flex gap-3 pb-1 max-sm:hidden">
        <span className="w-36 flex-none" />
        <span className="relative h-4 flex-1">
          {SCALE.map((hour) => (
            <span
              key={hour}
              className="absolute -translate-x-1/2 text-xs text-text-3 rtl:translate-x-1/2"
              style={{ insetInlineStart: `${place(`${String(hour)}:00`)}%` }}
            >
              {f.number(hour)}
            </span>
          ))}
        </span>
        <span className="w-11 flex-none" />
      </div>
      <ul className="m-0 flex list-none flex-col p-0" aria-label={t('manager.hours.week.title')}>
        {WEEKDAYS.map((day) => {
          const row = week[day];
          const near = direct[day];
          const name = t(`manager.hours.day.${day}`);
          const wrong = weekBad.has(day) || directBad.has(day);
          const editing = open.has(day) || wrong;
          return (
            <li key={day} className="border-b border-line-2 last:border-b-0">
              <div className="flex items-center gap-3 py-1.5">
                <div className="w-36 flex-none">
                  <Switch
                    label={name}
                    description={
                      row.on
                        ? `${f.digits(row.open)}–${f.digits(row.close)}`
                        : t('manager.hours.dayOff')
                    }
                    checked={row.on}
                    onChange={(on) => setDay(day, { on })}
                  />
                </div>
                <div className="relative h-11 min-w-0 flex-1 rounded-xl bg-track/60">
                  {row.on ? (
                    <>
                      <span
                        className="absolute inset-y-1.5 rounded-lg bg-tint ring-1 ring-primary/40"
                        style={{
                          insetInlineStart: `${place(row.open)}%`,
                          width: `${Math.max(1, place(row.close) - place(row.open))}%`,
                        }}
                      />
                      {near.on && (
                        <span
                          className="absolute bottom-2.5 h-1.5 rounded bg-primary"
                          style={{
                            insetInlineStart: `${place(near.open)}%`,
                            width: `${Math.max(1, place(near.close) - place(near.open))}%`,
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[13px] text-text-2">
                      {t('manager.hours.dayOff')}
                    </span>
                  )}
                </div>
                <IconButton
                  icon={editing ? 'collapse' : 'expand'}
                  aria-expanded={editing}
                  aria-label={t('manager.hours.editDay', { day: name })}
                  onClick={() => toggle(day)}
                  disabled={!row.on}
                />
              </div>
              {editing && row.on && (
                <div className="mb-3 flex flex-col gap-4 rounded-2xl bg-canvas p-4">
                  <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                    <legend className="mb-2 p-0 text-sm font-semibold">
                      {t('manager.hours.legend.week')}
                    </legend>
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-32 flex-1">
                        <SelectField
                          label={t('manager.hours.from', { day: name })}
                          options={options}
                          value={row.open}
                          onChange={(open) => setDay(day, { open })}
                        />
                      </div>
                      <div className="min-w-32 flex-1">
                        <SelectField
                          label={t('manager.hours.to', { day: name })}
                          options={options}
                          value={row.close}
                          onChange={(close) => setDay(day, { close })}
                          error={
                            weekBad.has(day) && row.close <= row.open
                              ? t('manager.hours.errors.order')
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  </fieldset>
                  <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                    <legend className="sr-only">{t('manager.hours.legend.direct')}</legend>
                    <Switch
                      label={t('manager.hours.legend.direct')}
                      description={t('manager.hours.direct.subtitle')}
                      checked={near.on}
                      onChange={(on) => setDirectDay(day, { on })}
                    />
                    {near.on && (
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-32 flex-1">
                          <SelectField
                            label={t('manager.hours.directFrom', { day: name })}
                            options={options}
                            value={near.open}
                            onChange={(open) => setDirectDay(day, { open })}
                          />
                        </div>
                        <div className="min-w-32 flex-1">
                          <SelectField
                            label={t('manager.hours.directTo', { day: name })}
                            options={options}
                            value={near.close}
                            onChange={(close) => setDirectDay(day, { close })}
                            error={
                              directBad.has(day) && near.close <= near.open
                                ? t('manager.hours.errors.order')
                                : undefined
                            }
                          />
                        </div>
                      </div>
                    )}
                  </fieldset>
                  <div>
                    <Button variant="outline" onClick={() => copyToAll(day)}>
                      {t('manager.hours.copyToAll')}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
