import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  WEEKDAYS,
  officeHoursQuery,
  useSaveOfficeHours,
  type LineForce,
  type OfficeHoursInput,
  type OfficeHoursState,
  type OpenHours,
  type Weekday,
} from '@/lib/sales/phoneCalls';
import { toast } from '@/lib/toast';

/** Every quarter hour of the day, `HH:MM`. */
const TIMES = Array.from({ length: 96 }, (_, i) =>
  [Math.floor(i / 4), (i % 4) * 15].map((part) => String(part).padStart(2, '0')).join(':'),
);
const FORCES = ['', 'open', 'closed'] as const satisfies readonly LineForce[];

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

const inputOf = (data: OfficeHoursState): OfficeHoursInput => ({
  week: data.week,
  direct: data.direct,
  closed_days: data.closed_days,
  force: data.force,
});

/**
 * The office phone line's hours (manager section): today's switch, the weekly hours, the hours a
 * caller can dial a person's number, and closed days. The office worker applies them to the PBX
 * within seconds. Until the first save, the page shows the PBX's own hours.
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
      <TodaySwitch data={data} />
      <HoursForm data={data} />
    </>
  );
}

/** Saves itself: open or closed until midnight, or back to the hours. */
function TodaySwitch({ data }: { data: OfficeHoursState }) {
  const { t } = useTranslation('sales');
  const save = useSaveOfficeHours();
  const [force, setForce] = useState<LineForce>(data.force);

  const change = (value: LineForce) => {
    const before = force;
    setForce(value);
    save.mutate(
      { ...inputOf(data), force: value },
      {
        onSuccess: () => toast.success(t(`manager.hours.today.saved.${value || 'auto'}`)),
        onError: () => {
          setForce(before);
          toast.error(t('error'));
        },
      },
    );
  };

  return (
    <SectionCard
      id="office-hours-today"
      variant="panel"
      title={t('manager.hours.today.title')}
      subtitle={t('manager.hours.today.subtitle')}
    >
      <ChoiceGroup
        legend={t('manager.hours.today.legend')}
        hideLegend
        look="segmented"
        options={FORCES.map((value) => ({
          value,
          label: t(`manager.hours.today.${value || 'auto'}`),
        }))}
        value={force}
        onChange={change}
      />
    </SectionCard>
  );
}

function HoursForm({ data }: { data: OfficeHoursState }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const save = useSaveOfficeHours();
  const [week, setWeek] = useState(() =>
    draftOf(data.week, { day: 'sat', open: '09:00', close: '18:00' }),
  );
  const [direct, setDirect] = useState(() =>
    draftOf(data.direct, { day: 'sat', open: '11:30', close: '13:00' }),
  );
  const [closedDays, setClosedDays] = useState(data.closed_days);
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

  const addDay = () => {
    if (!picked) {
      setPickError(true);
      return;
    }
    setClosedDays((days) => [...new Set([...days, picked])].sort());
    setPicked('');
  };

  const submit = () => {
    setTried(true);
    if (weekBad.size > 0 || directBad.size > 0 || weekEmpty) {
      setAttempt((n) => n + 1);
      return;
    }
    save.mutate(
      { week: daysOf(week), direct: daysOf(direct), closed_days: closedDays, force: data.force },
      {
        onSuccess: (saved) => {
          setClosedDays(saved.closed_days);
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
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <SectionCard
        id="office-hours-week"
        variant="panel"
        title={t('manager.hours.week.title')}
        subtitle={t('manager.hours.week.subtitle')}
      >
        <WeekEditor week={week} onChange={setWeek} bad={tried ? weekBad : new Set()} group="week" />
        {tried && weekEmpty && (
          <p role="alert" className="m-0 text-[13px] text-danger">
            {t('manager.hours.errors.empty')}
          </p>
        )}
      </SectionCard>
      <SectionCard
        id="office-hours-direct"
        variant="panel"
        title={t('manager.hours.direct.title')}
        subtitle={t('manager.hours.direct.subtitle')}
      >
        <WeekEditor
          week={direct}
          onChange={setDirect}
          bad={tried ? directBad : new Set()}
          group="direct"
        />
      </SectionCard>
      <SectionCard
        id="office-hours-closed"
        variant="panel"
        title={t('manager.hours.closedDays.title')}
        subtitle={t('manager.hours.closedDays.subtitle')}
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
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
                  onClick={() => setClosedDays((days) => days.filter((value) => value !== day))}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {t('manager.hours.save')}
        </Button>
      </div>
    </form>
  );
}

function WeekEditor({
  week,
  onChange,
  bad,
  group,
}: {
  week: Week;
  onChange: (week: Week) => void;
  bad: Set<Weekday>;
  group: 'week' | 'direct';
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const options = TIMES.map((value) => ({ value, label: f.digits(value) }));
  const set = (day: Weekday, change: Partial<DayDraft>) =>
    onChange({ ...week, [day]: { ...week[day], ...change } });

  return (
    <ul className="m-0 flex list-none flex-col p-0" aria-label={t(`manager.hours.${group}.title`)}>
      {WEEKDAYS.map((day) => {
        const row = week[day];
        const name = t(`manager.hours.day.${day}`);
        const wrong = bad.has(day);
        return (
          <li
            key={day}
            className="flex flex-col gap-2 border-b border-line-2 py-2 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="sm:w-48">
              <Switch
                label={name}
                {...(!row.on && { description: t('manager.hours.dayOff') })}
                checked={row.on}
                onChange={(on) => set(day, { on })}
              />
            </div>
            {row.on && (
              <div className="flex flex-1 flex-wrap items-start gap-2">
                <div className="min-w-32 flex-1">
                  <SelectField
                    label={t('manager.hours.from', { day: name })}
                    options={options}
                    value={row.open}
                    onChange={(open) => set(day, { open })}
                  />
                </div>
                <div className="min-w-32 flex-1">
                  <SelectField
                    label={t('manager.hours.to', { day: name })}
                    options={options}
                    value={row.close}
                    onChange={(close) => set(day, { close })}
                    error={
                      wrong && row.close <= row.open ? t('manager.hours.errors.order') : undefined
                    }
                  />
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
