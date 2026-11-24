import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import type { HrAlert, TaskNumbers, Team } from '../api';
import { dayOf } from '../format';
import { personPath, teamPath, teamsPath } from '../paths';
import { useShare } from './share';

/** Points up or down against last month ("▲ 4"); nothing when either month has no share. */
export function Trend({
  now,
  before,
  onHero = false,
}: {
  now: number | null;
  before: number | null;
  onHero?: boolean;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  if (now === null || before === null) return null;
  const points = Math.round((now - before) * 100);
  if (points === 0) return null;
  const up = points > 0;
  const tone = onHero ? (up ? 'text-live' : 'text-hero-danger') : up ? 'text-good' : 'text-danger';
  return (
    <span className={`text-xs font-bold whitespace-nowrap ${tone}`}>
      {t(up ? 'tasks.up' : 'tasks.down', { n: f.number(Math.abs(points)) })}
    </span>
  );
}

/**
 * Open tasks as one bar: overdue, due today and the rest, each in its colour. Decoration: the
 * numbers are written beside it.
 */
export function TaskBar({ tasks, onHero = false }: { tasks: TaskNumbers; onHero?: boolean }) {
  const rest = Math.max(tasks.open - tasks.overdue - tasks.today, 0);
  const width = (n: number) => `${String(tasks.open ? (n / tasks.open) * 100 : 0)}%`;
  return (
    <div
      aria-hidden="true"
      className={`flex h-2 overflow-hidden rounded-full ${onHero ? 'bg-hero-line' : 'bg-track'}`}
    >
      <span className="h-full bg-hero-danger" style={{ width: width(tasks.overdue) }} />
      <span className="h-full bg-hero-current" style={{ width: width(tasks.today) }} />
      <span className="h-full bg-hero-info" style={{ width: width(rest) }} />
    </div>
  );
}

/**
 * HR's day, everyone's tasks (canvas "وضعیت تیم‌ها", the dark card on «امروز»): open ones (overdue,
 * due today, on schedule), this month's on-time share against last month's, and this month's done.
 */
export function TaskSummary({ tasks }: { tasks: TaskNumbers }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const share = useShare();
  const n = (value: number) => f.number(value);
  const rest = Math.max(tasks.open - tasks.overdue - tasks.today, 0);
  const legend = [
    { key: 'overdue', value: tasks.overdue, dot: 'bg-hero-danger' },
    { key: 'today', value: tasks.today, dot: 'bg-hero-current' },
    { key: 'onSchedule', value: rest, dot: 'bg-hero-info' },
  ] as const;
  return (
    <section
      aria-label={t('tasks.summary')}
      className="grid gap-3 rounded-card-sm bg-hero p-4 text-on-hero shadow-hero lg:grid-cols-[1.4fr_1fr_1fr] lg:rounded-[32px] lg:p-6"
    >
      <div className="flex flex-col gap-3 rounded-2xl bg-hero-raised px-5 py-4">
        <span className="text-sm text-on-hero-2">{t('tasks.open')}</span>
        <span className="font-display text-4xl font-bold tabular-nums">{n(tasks.open)}</span>
        <TaskBar tasks={tasks} onHero />
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-on-hero-2">
          {legend.map((item) => (
            <li key={item.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`size-2 rounded-full ${item.dot}`} />
              {t(`tasks.${item.key}`, { n: n(item.value) })}
            </li>
          ))}
        </ul>
      </div>
      <dl className="m-0 contents">
        <div className="flex flex-col gap-2 rounded-2xl bg-hero-raised px-5 py-4">
          <dt className="text-sm text-on-hero-2">{t('tasks.onTime')}</dt>
          <dd className="m-0 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold tabular-nums">
              {share(tasks.on_time)}
            </span>
            <Trend now={tasks.on_time} before={tasks.on_time_before} onHero />
          </dd>
          <dd className="m-0 text-xs leading-5 text-on-hero-2">{t('tasks.onTimeHint')}</dd>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-hero-raised px-5 py-4">
          <dt className="text-sm text-on-hero-2">{t('tasks.done')}</dt>
          <dd className="m-0 font-display text-3xl font-bold tabular-nums">{n(tasks.done)}</dd>
          <dd className="m-0 text-xs leading-5 text-on-hero-2">
            {t('tasks.doneSplit', {
              onTime: n(tasks.done_on_time),
              late: n(tasks.done - tasks.done_on_time),
            })}
          </dd>
        </div>
      </dl>
    </section>
  );
}

const ALERT_LOOK: Record<HrAlert['kind'], { icon: IconName; tone: string }> = {
  team_overdue: { icon: 'alert', tone: 'bg-danger-tint text-danger' },
  old_overdue: { icon: 'clock', tone: 'bg-warn-tint text-warn' },
  contract_ending: { icon: 'document', tone: 'bg-warn-tint text-warn' },
  no_team: { icon: 'user', tone: 'bg-info-tint text-info' },
};

/** What the day's numbers say is worth a look, each a link to where it is fixed. */
export function Alerts({ alerts }: { alerts: HrAlert[] }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  if (alerts.length === 0) return null;
  const team = (name: Team | null) => (name ? t(`team.${name}`) : t('teams.none'));
  const textOf = (alert: HrAlert): { to: string; title: string; sub: string } => {
    switch (alert.kind) {
      case 'team_overdue':
        return {
          to: teamPath(alert.team),
          title: t('alerts.teamOverdue', { team: team(alert.team), n: f.number(alert.overdue) }),
          sub: t('alerts.teamOverdueSub', {
            name: alert.staff.name,
            n: f.number(alert.staff_overdue),
          }),
        };
      case 'old_overdue':
        return {
          to: personPath(alert.staff.id),
          title: t('alerts.oldOverdue', { name: alert.staff.name, n: f.number(alert.days) }),
          sub: team(alert.team),
        };
      case 'contract_ending':
        return {
          to: personPath(alert.staff.id),
          title: t('alerts.contractEnding', { name: alert.staff.name, n: f.number(alert.days) }),
          sub: t('alerts.contractEndingSub', {
            team: team(alert.team),
            day: f.dateShort(dayOf(alert.day)),
          }),
        };
      case 'no_team':
        return {
          to: teamsPath,
          title: t('alerts.noTeam', { n: f.number(alert.count) }),
          sub: t('alerts.noTeamSub'),
        };
    }
  };
  return (
    <section aria-labelledby="hr-alerts" className="flex flex-col gap-3">
      <h2 id="hr-alerts" className="m-0 text-section font-bold">
        {t('alerts.title')}
      </h2>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {alerts.map((alert) => {
          const { to, title, sub } = textOf(alert);
          const look = ALERT_LOOK[alert.kind];
          return (
            <li key={alert.kind}>
              <Link
                to={to}
                className="flex h-full min-h-row items-start gap-3 rounded-card-sm bg-surface p-4 shadow-panel hover:bg-row-highlight focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-9 flex-none items-center justify-center rounded-xl ${look.tone}`}
                >
                  <Icon name={look.icon} size={18} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-bold">{title}</span>
                  <span className="text-xs leading-5 text-text-2">{sub}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
