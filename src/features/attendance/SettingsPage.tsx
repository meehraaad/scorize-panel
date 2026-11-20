import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { Link } from 'react-router';
import { hasPermission } from '@/lib/auth/roles';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useMapEnrollment, useReadNames } from './actions';
import {
  PHONE_HOURS_PATH,
  PHONE_HOURS_PERMISSION,
  devicesQuery,
  enrollmentsQuery,
  peopleQuery,
  scheduleQuery,
  type Employee,
  type Enrollment,
} from './api';

const NONE = '';

/**
 * The settings: the week the reports count (read from the office phone hours), the terminal, and
 * which staff member each terminal user number is. A number nobody is mapped to is highlighted: its
 * punches show in the reports as "device number N" and count for nobody's hours.
 */
export default function SettingsPage() {
  const { t } = useTranslation('attendance');
  const f = useFormat();
  const { data: enrollments } = useSuspenseQuery(enrollmentsQuery);
  const { data: people } = useSuspenseQuery(peopleQuery);
  const { data: devices } = useSuspenseQuery(devicesQuery);
  const readNames = useReadNames();
  const rows = enrollments.results;
  const unmapped = rows.filter((row) => !row.employee).length;

  return (
    <>
      <ScheduleCard />
      <SectionCard
        id="attendance-devices"
        title={t('settings.devices')}
        end={
          <Button
            variant="outline"
            disabled={readNames.isPending}
            onClick={() =>
              readNames.mutate(undefined, {
                onSuccess: () => toast.success(t('settings.readNamesAsked')),
                onError: () => toast.error(t('settings.error')),
              })
            }
          >
            {t('settings.readNames')}
          </Button>
        }
      >
        <ul className="m-0 list-none p-0">
          {devices.results.map((device) => (
            <li
              key={device.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 lg:px-8"
            >
              <span className="text-[15px] font-semibold">
                {device.name || device.model || device.sn}
              </span>
              <span className="text-[13px] text-text-2">
                <bdi>{device.sn}</bdi>
                {' · '}
                {device.last_seen_at
                  ? t('settings.lastSeen', { when: f.timeAgo(device.last_seen_at) })
                  : t('settings.neverSeen')}
              </span>
            </li>
          ))}
          {devices.results.length === 0 && (
            <li>
              <EmptyState variant="padded">{t('settings.noDevice')}</EmptyState>
            </li>
          )}
        </ul>
      </SectionCard>
      <SectionCard
        id="attendance-numbers"
        title={t('settings.label')}
        subtitle={t('settings.subtitle')}
      >
        {unmapped > 0 && (
          <p className="m-0 px-5 pt-5 text-sm text-warn lg:px-8" role="status">
            {t('settings.unmapped', { n: f.number(unmapped) })}
          </p>
        )}
        {rows.length === 0 ? (
          <EmptyState variant="padded">{t('settings.empty')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0 pt-3">
            {rows.map((row) => (
              <li key={row.id}>
                <EnrollmentRow row={row} people={people.results} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

/**
 * The counted week: each day's start, the coming closed days and the grace. Read only: the hours
 * come from the office phone hours, edited by sales managers (linked for them).
 */
function ScheduleCard() {
  const { t } = useTranslation('attendance');
  const f = useFormat();
  const user = useUser();
  const { data } = useSuspenseQuery(scheduleQuery);
  return (
    <SectionCard
      id="attendance-schedule"
      title={t('schedule.title')}
      subtitle={t('schedule.subtitle', { n: f.number(data.grace_minutes) })}
      end={
        hasPermission(user, PHONE_HOURS_PERMISSION) ? (
          <Link to={PHONE_HOURS_PATH} className={buttonClass('outline')}>
            {t('schedule.edit')}
          </Link>
        ) : undefined
      }
    >
      {!data.saved && (
        <p className="m-0 px-5 text-sm text-warn lg:px-8" role="status">
          {t('schedule.notSaved')}
        </p>
      )}
      <ul
        aria-label={t('schedule.week')}
        className="m-0 grid list-none grid-cols-2 gap-2 p-5 sm:grid-cols-4 lg:px-8"
      >
        {data.week.map((row) => (
          <li
            key={row.day}
            className={`flex flex-col gap-0.5 rounded-xl px-3 py-2.5 ${row.start ? 'bg-tint' : 'bg-canvas'}`}
          >
            <span className="text-[13px] text-text-2">{t(`schedule.day.${row.day}`)}</span>
            <span className="text-[15px] font-semibold">
              {row.start ? f.digits(row.start) : t('schedule.off')}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-5 lg:px-8">
        <span className="text-[13px] text-text-2">{t('schedule.closed')}</span>
        {data.closed_today && (
          <Chip tone="warn" small>
            {t('schedule.closedToday')}
          </Chip>
        )}
        {data.closed_days.map((day) => (
          <Chip key={day} tone="neutral" small>
            {f.weekday(day)}
          </Chip>
        ))}
        {!data.closed_today && data.closed_days.length === 0 && (
          <span className="text-[13px]">{t('schedule.noClosed')}</span>
        )}
      </div>
    </SectionCard>
  );
}

function EnrollmentRow({ row, people }: { row: Enrollment; people: Employee[] }) {
  const { t } = useTranslation('attendance');
  const f = useFormat();
  const map = useMapEnrollment();
  const value = row.employee ? String(row.employee.id) : NONE;
  // A person who left may still be mapped: keep them in the list so the select shows them.
  const options = [
    { value: NONE, label: t('settings.nobody') },
    ...(row.employee && !people.some((person) => person.id === row.employee?.id)
      ? [{ value: String(row.employee.id), label: row.employee.name }]
      : []),
    ...people.map((person) => ({ value: String(person.id), label: person.name })),
  ];
  return (
    <div
      className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 ${row.employee ? '' : 'bg-warn-tint'}`}
    >
      <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <span className="text-[15px] font-semibold">
          {row.name || t('person.number', { n: f.number(row.enroll_id) })}
        </span>
        <span className="text-[13px] text-text-2">
          {t('settings.number', { n: f.number(row.enroll_id) })}
        </span>
      </span>
      {!row.employee && (
        <Chip tone="warn" small>
          {t('person.unmapped')}
        </Chip>
      )}
      <SelectField
        inline
        hideLabel
        label={t('settings.mapTo', { n: f.number(row.enroll_id) })}
        value={value}
        options={options}
        onChange={(next) =>
          map.mutate(
            { id: row.id, employee: next === NONE ? null : Number(next) },
            {
              onSuccess: () => toast.success(t('settings.saved')),
              onError: () => toast.error(t('settings.error')),
            },
          )
        }
      />
    </div>
  );
}
