import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Chip } from '@/components/ui/Chip';
import { FilterTabs } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { TaskBar, Trend } from '../components/TaskStatus';
import { shareTone, useShare } from '../components/share';
import { PersonLink } from '../components/PersonLink';
import { teamPath } from '../paths';
import { STATE_TONE, teamsQuery, type TeamCard, type TeamState } from './api';

type Filter = 'all' | 'notGood' | 'good';
const FILTERS: readonly Filter[] = ['all', 'notGood', 'good'];
const FACES = 5;

/**
 * «کارکنان › تیم‌ها» (canvas "وضعیت تیم‌ها"): a card per team (its people, who they report to,
 * their open and overdue tasks, this month's on-time share and done, a state), and the people
 * with no team, to give them one. A card opens the team's page.
 */
export default function TeamsView() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const { data } = useSuspenseQuery(teamsQuery);
  const [filter, setFilter] = useState<Filter>('all');
  const matches = (state: TeamState) =>
    filter === 'all' || (filter === 'good' ? state === 'good' : state !== 'good');
  const cards = data.teams.filter((card) => matches(card.state));
  return (
    <section aria-labelledby="hr-teams" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="hr-teams" className="m-0 text-section font-bold">
          {t('teams.title')}
        </h2>
        <FilterTabs
          label={t('teams.filter')}
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((value) => ({
            value,
            label: t(`teams.filters.${value}`),
            count: f.number(
              data.teams.filter((card) => {
                if (value === 'all') return true;
                return value === 'good' ? card.state === 'good' : card.state !== 'good';
              }).length,
            ),
          }))}
        />
      </div>
      <ul
        aria-label={t('teams.title')}
        className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3"
      >
        {cards.map((card) => (
          <TeamItem key={card.team} card={card} />
        ))}
        {filter !== 'good' && data.no_team.length > 0 && (
          <li className="flex flex-col gap-3 rounded-card-sm border border-dashed border-line-2 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <h3 className="m-0 text-section font-bold">{t('teams.none')}</h3>
                <span className="text-sm text-text-2">
                  {t('teams.noneHint', { n: f.number(data.no_team.length) })}
                </span>
              </div>
              <Chip tone="warn" small>
                {t('teams.setTeam')}
              </Chip>
            </div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {data.no_team.map((person) => (
                <li key={person.id}>
                  <PersonLink id={person.id} name={person.name} face={person.face} />
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
      {cards.length === 0 && <p className="m-0 text-sm text-text-2">{t('teams.empty')}</p>}
    </section>
  );
}

function TeamItem({ card }: { card: TeamCard }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const share = useShare();
  const { tasks, counts } = card;
  const name = t(`team.${card.team}`);
  const chips = [
    counts.trial > 0 && { key: 'trial', tone: 'primary' as const, n: counts.trial },
    counts.joining > 0 && { key: 'joining', tone: 'info' as const, n: counts.joining },
    counts.leaving > 0 && { key: 'leaving', tone: 'neutral' as const, n: counts.leaving },
    counts.ending > 0 && { key: 'ending', tone: 'warn' as const, n: counts.ending },
  ].filter(Boolean) as {
    key: 'trial' | 'joining' | 'leaving' | 'ending';
    tone: 'primary' | 'info' | 'neutral' | 'warn';
    n: number;
  }[];
  return (
    <li className="flex">
      <Link
        to={teamPath(card.team)}
        aria-label={t('teams.openTeam', { team: name })}
        className="flex w-full flex-col gap-4 rounded-card-sm bg-surface p-5 shadow-panel hover:bg-row-highlight focus-visible:outline-2 focus-visible:outline-focus"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="m-0 text-section font-bold">{t('teams.name', { team: name })}</h3>
            <span className="truncate text-sm text-text-2">
              {card.manager
                ? t('teams.manager', { name: card.manager.name })
                : t('teams.noManager')}
            </span>
          </div>
          <Chip tone={STATE_TONE[card.state]} small dot>
            {t(`teams.state.${card.state}`)}
          </Chip>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex">
            {card.people.slice(0, FACES).map((person) => (
              <Avatar key={person.id} name={person.name} face={person.face} size="xs" stacked />
            ))}
          </span>
          <span className="text-sm text-text-2">
            {t('teams.people', { n: f.number(card.people.length) })}
          </span>
        </div>
        <dl className="m-0 grid grid-cols-3 border-t border-hair pt-3">
          <div className="flex flex-col gap-1 pe-3">
            <dt className="text-xs text-text-2">{t('teams.open')}</dt>
            <dd className="m-0 text-xl font-bold tabular-nums">{f.number(tasks.open)}</dd>
            <dd className="m-0 pt-1">
              <TaskBar tasks={tasks} />
            </dd>
          </div>
          <div className="flex flex-col gap-1 border-s border-hair px-3">
            <dt className="text-xs text-text-2">{t('teams.overdue')}</dt>
            <dd
              className={`m-0 text-xl font-bold tabular-nums ${tasks.overdue ? 'text-danger' : 'text-good'}`}
            >
              {f.number(tasks.overdue)}
            </dd>
            <dd className="m-0 text-xs text-text-2">
              {t('teams.dueToday', { n: f.number(tasks.today) })}
            </dd>
          </div>
          <div className="flex flex-col gap-1 border-s border-hair ps-3">
            <dt className="text-xs text-text-2">{t('teams.onTime')}</dt>
            <dd className="m-0 flex items-baseline gap-1.5">
              <span className={`text-xl font-bold tabular-nums ${shareTone(tasks.on_time)}`}>
                {share(tasks.on_time)}
              </span>
              <Trend now={tasks.on_time} before={tasks.on_time_before} />
            </dd>
            <dd className="m-0 text-xs text-text-2">
              {t('teams.done', { n: f.number(tasks.done) })}
            </dd>
          </div>
        </dl>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Chip key={chip.key} tone={chip.tone} small>
              {t(`teams.counts.${chip.key}`, { n: f.number(chip.n) })}
            </Chip>
          ))}
          <span className="ms-auto flex items-center gap-1 text-sm font-semibold text-primary-text">
            {t('teams.details')}
            <Icon name="chevronStart" size={16} />
          </span>
        </div>
      </Link>
    </li>
  );
}
