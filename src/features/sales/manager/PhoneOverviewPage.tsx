import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { LinkTile, TileGrid } from '@/components/ui/LinkTile';
import { PageColumns } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  officeHoursQuery,
  phoneMenusQuery,
  phoneTeamsQuery,
  phoneVoicesQuery,
  teamBreaksQuery,
  WEEKDAYS,
  type OfficeHoursState,
  type PhoneMenus,
  type PhoneTeams,
  type TeamBreaks,
} from '@/lib/sales/phoneCalls';
import { salesPath } from '../paths';
import { LineSwitch } from './LineSwitch';
import { CLOSED_MENU, MAIN_MENU, phoneIssues, teamEntrances, type PhoneIssue } from './phoneMap';
import { useKeyTarget, useMenuName } from './phoneNames';
import { KeyBadge } from './KeyBadge';
import { WhoRings } from './WhoRings';

const phonePath = (section: string) => salesPath(`manager/phone/${section}`);

/**
 * The office line at a glance (manager section): open or closed now with today's switch, each
 * part's summary, what a caller hears and where each key leads, and what looks wrong.
 */
export default function PhoneOverviewPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  // All read in the route's page data; a part that isn't on the server stays empty.
  const hours = useQuery({ ...officeHoursQuery, enabled: ON_SERVER.officeHours }).data;
  const teams = useQuery({ ...phoneTeamsQuery, enabled: ON_SERVER.phoneTeams }).data;
  const menus = useQuery({ ...phoneMenusQuery, enabled: ON_SERVER.phoneMenus }).data;
  const voices = useQuery({ ...phoneVoicesQuery, enabled: ON_SERVER.phoneVoices }).data;
  const breaks = useQuery({ ...teamBreaksQuery, enabled: ON_SERVER.teamBreaks }).data;
  const seen = teams?.seen_at ?? menus?.seen_at ?? voices?.seen_at ?? null;
  const issues = phoneIssues({ teams, menus, voices });

  return (
    <>
      <PageHeader
        title={t('manager.overview.title')}
        subtitle={
          seen ? t('manager.teams.seen', { time: f.dateTime(seen) }) : t('manager.teams.notSeen')
        }
      />
      {hours && <LineHero data={hours} />}
      <Summary
        hours={hours}
        teams={teams}
        menus={menus}
        voices={voices?.voices.length}
        breaks={breaks}
      />
      {menus && menus.menus.length > 0 && <CallMap menus={menus} teams={teams} breaks={breaks} />}
      <PageColumns
        asideLabel={t('manager.teams.breaks.title')}
        main={<Issues issues={issues} />}
        aside={breaks && breaks.people.length > 0 && <WhoRings people={breaks.people} />}
      />
    </>
  );
}

/** Open or closed now, what that means for a caller, and today's switch. */
function LineHero({ data }: { data: OfficeHoursState }) {
  const { t } = useTranslation('sales');
  return (
    <section
      aria-labelledby="phone-line-now"
      className="flex flex-wrap items-center gap-6 rounded-card-sm bg-hero p-6 text-on-hero lg:rounded-card lg:p-8"
    >
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
        <span
          className={`inline-flex items-center gap-2 text-[13px] font-semibold ${
            data.open_now ? 'text-live' : 'text-hero-current'
          }`}
        >
          <span aria-hidden="true" className="size-2.5 rounded-full bg-current" />
          {t('manager.overview.now')}
        </span>
        <h2 id="phone-line-now" className="m-0 font-display text-2xl font-bold lg:text-[28px]">
          {t(data.open_now ? 'manager.hours.openNow' : 'manager.hours.closedNow')}
        </h2>
        <p className="m-0 text-[15px] leading-7 text-on-hero-2">
          {t(data.open_now ? 'manager.overview.openMeans' : 'manager.overview.closedMeans')}
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3 text-text">
        <span className="px-1 text-[13px] font-semibold text-text-2">
          {t('manager.overview.todayOnly')}
        </span>
        <LineSwitch data={data} />
      </div>
    </section>
  );
}

function Summary({
  hours,
  teams,
  menus,
  voices,
  breaks,
}: {
  hours: OfficeHoursState | undefined;
  teams: PhoneTeams | undefined;
  menus: PhoneMenus | undefined;
  voices: number | undefined;
  breaks: TeamBreaks | undefined;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const firstDay =
    hours && WEEKDAYS.map((day) => hours.week.find((row) => row.day === day)).find(Boolean);
  const resting = breaks?.people.filter((person) => person.on_break).length ?? 0;
  const keys = menus?.menus.reduce((sum, menu) => sum + menu.keys.length, 0) ?? 0;
  const tiles = [
    hours && {
      id: 'hours',
      title: t('manager.phone.section.hours'),
      text: firstDay
        ? t('manager.overview.hoursLine', {
            days: f.number(hours.week.length),
            open: f.digits(firstDay.open),
            close: f.digits(firstDay.close),
          })
        : t('manager.overview.hoursNone'),
    },
    menus && {
      id: 'menus',
      title: t('manager.phone.section.menus'),
      text: t('manager.overview.menusLine', {
        menus: f.number(menus.menus.length),
        keys: f.number(keys),
      }),
    },
    teams && {
      id: 'teams',
      title: t('manager.phone.section.teams'),
      text: [
        t('manager.overview.teamsLine', {
          teams: f.number(teams.teams.length),
          people: f.number(teams.people.length),
        }),
        ...(resting > 0
          ? [t('manager.overview.resting', { count: resting, n: f.number(resting) })]
          : []),
      ].join(' · '),
    },
    voices !== undefined && {
      id: 'voices',
      title: t('manager.phone.section.voices'),
      text: t('manager.overview.voicesLine', { count: voices, n: f.number(voices) }),
    },
  ].filter((tile): tile is { id: string; title: string; text: string } => Boolean(tile));
  if (tiles.length === 0) return null;
  return (
    <TileGrid>
      {tiles.map((tile) => (
        <LinkTile
          key={tile.id}
          to={phonePath(tile.id)}
          title={tile.title}
          text={tile.text}
          footer={t('manager.overview.edit')}
        />
      ))}
    </TileGrid>
  );
}

/** What a caller hears and where each key of the main menu leads, step by step. */
function CallMap({
  menus,
  teams,
  breaks,
}: {
  menus: PhoneMenus;
  teams: PhoneTeams | undefined;
  breaks: TeamBreaks | undefined;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const menuName = useMenuName();
  const target = useKeyTarget(menus.options);
  const main = menus.menus.find((menu) => menu.name === MAIN_MENU) ?? menus.menus[0];
  const closed = menus.menus.find((menu) => menu.name === CLOSED_MENU);
  if (!main) return null;
  const resting = new Set(
    (breaks?.people ?? []).filter((person) => person.on_break).map((person) => person.id),
  );
  // Teams the main menu sends callers to, straight or through one more menu.
  const entrances = teamEntrances(menus);
  const viaMain = (teams?.teams ?? []).filter((team) =>
    (entrances.get(team.number) ?? []).some(
      (place) =>
        place.menuId === main.id ||
        main.keys.some((key) => key.kind === 'menu' && key.target === place.menuId),
    ),
  );
  const people = new Map((teams?.people ?? []).map((person) => [person.id, person]));

  return (
    <SectionCard
      id="phone-call-map"
      title={t('manager.overview.map.title')}
      subtitle={t('manager.overview.map.subtitle')}
    >
      <div className="flex flex-wrap items-start gap-4 px-5 pt-2 pb-6 lg:px-8 lg:pb-8">
        <MapColumn step={1} title={t('manager.overview.map.call')}>
          <div className="flex min-h-12 items-center gap-2.5 rounded-2xl bg-hero px-3 py-2.5 text-on-hero">
            <Icon name="phone" size={18} />
            <span className="text-sm font-semibold">{t('manager.overview.map.incoming')}</span>
          </div>
        </MapColumn>
        <MapColumn step={2} title={t('manager.overview.map.when')}>
          <MapNode
            to={phonePath('hours')}
            icon="clock"
            title={t('manager.overview.map.inHours')}
            text={t('manager.overview.map.hears', { menu: menuName(main.name) })}
            tone="primary"
          />
          <MapNode
            to={phonePath('hours')}
            icon="lock"
            title={t('manager.overview.map.outHours')}
            text={
              closed
                ? t('manager.overview.map.hears', { menu: menuName(closed.name) })
                : t('manager.overview.map.closedMessage')
            }
          />
        </MapColumn>
        <MapColumn step={3} title={t('manager.overview.map.keys', { menu: menuName(main.name) })}>
          {main.keys.length === 0 ? (
            <p className="m-0 text-[13px] text-text-2">{t('manager.menus.noKeys')}</p>
          ) : (
            main.keys.map((key) => (
              <Link
                key={key.key}
                to={`${phonePath('menus')}?menu=${main.id}`}
                className="flex min-h-12 items-center gap-2.5 rounded-2xl px-2 py-1.5 text-text shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)]"
              >
                <KeyBadge value={f.digits(key.key)} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{target(key)}</span>
                  <span className="text-xs text-text-2">{t(`manager.menus.kind.${key.kind}`)}</span>
                </span>
              </Link>
            ))
          )}
        </MapColumn>
        {viaMain.length > 0 && (
          <MapColumn step={4} title={t('manager.overview.map.rings')}>
            {viaMain.map((team) => {
              const ringing = team.members.filter((id) => !resting.has(id));
              return (
                <Link
                  key={team.number}
                  to={phonePath('teams')}
                  className="flex flex-col gap-2 rounded-2xl px-3 py-2.5 text-text shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)]"
                >
                  <span className="text-sm font-semibold">
                    {team.name || t('manager.teams.untitled', { number: f.digits(team.number) })}
                  </span>
                  <span className="text-xs text-text-2">
                    {t('manager.overview.map.ringing', {
                      ringing: f.number(ringing.length),
                      all: f.number(team.members.length),
                    })}
                  </span>
                  {team.members.length > 0 && (
                    <span className="flex ps-2.5">
                      {team.members.map((id) => (
                        <span
                          key={id}
                          className={`not-first:-ms-2.5 ${resting.has(id) ? 'opacity-40' : ''}`}
                        >
                          <Avatar name={people.get(id)?.name ?? ''} size="sm" stacked />
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              );
            })}
          </MapColumn>
        )}
      </div>
    </SectionCard>
  );
}

function MapColumn({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  const f = useFormat();
  return (
    <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-2">
      <h3 className="m-0 text-xs font-bold text-text-2">
        {f.number(step)} · {title}
      </h3>
      {children}
    </div>
  );
}

function MapNode({
  to,
  icon,
  title,
  text,
  tone = 'plain',
}: {
  to: string;
  icon: 'clock' | 'lock';
  title: string;
  text: string;
  tone?: 'plain' | 'primary';
}) {
  return (
    <Link
      to={to}
      className={`flex min-h-12 items-center gap-2.5 rounded-2xl px-3 py-2.5 ${
        tone === 'primary'
          ? 'bg-tint text-primary-text'
          : 'text-text shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)]'
      }`}
    >
      <Icon name={icon} size={18} />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-text-2">{text}</span>
      </span>
    </Link>
  );
}

/** What looks wrong on the line, each with a link to the sub-page that fixes it. */
function Issues({ issues }: { issues: PhoneIssue[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const menuName = useMenuName();
  const text = (issue: PhoneIssue) => {
    if (issue.kind === 'teamUnreached')
      return t('manager.overview.issues.teamUnreached', { name: issue.name });
    if (issue.kind === 'unknownExtensions')
      return t('manager.overview.issues.unknownExtensions', {
        name: issue.name,
        list: f.digits(issue.list.join('، ')),
      });
    if (issue.kind === 'voiceFailed')
      return t('manager.overview.issues.voiceFailed', { name: menuName(issue.name) });
    return t('manager.overview.issues.voiceUnused', { name: menuName(issue.name) });
  };
  return (
    <SectionCard
      id="phone-issues"
      variant="panel"
      title={t('manager.overview.issues.title')}
      badge={
        issues.length > 0 && (
          <Chip tone="warn" small>
            {f.number(issues.length)}
          </Chip>
        )
      }
      subtitle={t('manager.overview.issues.subtitle')}
    >
      {issues.length === 0 ? (
        <p className="m-0 flex items-center gap-2 text-[15px] text-good">
          <Icon name="check" size={18} />
          {t('manager.overview.issues.none')}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {issues.map((issue, index) => (
            <li
              key={index}
              className="flex min-h-12 items-center gap-3 border-b border-line-2 py-2 last:border-b-0"
            >
              <span className={issue.kind === 'voiceFailed' ? 'text-danger' : 'text-warn'}>
                <Icon name="alert" size={18} />
              </span>
              <span className="min-w-0 flex-1 text-[15px] leading-7">{text(issue)}</span>
              <Link
                to={phonePath(issue.to)}
                className="text-sm font-semibold whitespace-nowrap text-primary-text"
              >
                {t(`manager.overview.issues.fix.${issue.to}`)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
