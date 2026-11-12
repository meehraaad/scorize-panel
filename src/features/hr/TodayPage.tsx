import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { todayQuery } from './api';
import { PersonLink } from './components/PersonLink';
import { CONTRACT_TONE, dayOf, daysUntil } from './format';
import { hrPath } from './paths';

const ATTENDANCE = ['present', 'late', 'absent', 'pending'] as const;

/**
 * HR's day (canvas "امروز منابع انسانی"): how many work here and how, today's attendance from the
 * office terminal, the joinings and leavings under way, contracts and trials ending within a month
 * and the week's birthdays.
 */
export default function TodayPage() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const { data } = useSuspenseQuery(todayQuery);
  const { counts, attendance } = data;
  const n = (value: number) => f.number(value);

  const main = (
    <PageStack>
      <SectionCard
        id="hr-moves"
        title={t('today.moves')}
        end={
          <Link to={hrPath('moves')} className="text-sm font-semibold text-primary-text">
            {t('today.allMoves')}
          </Link>
        }
      >
        {data.moves.length === 0 ? (
          <EmptyState variant="inset">{t('today.noMoves')}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 px-3 pb-3">
            {data.moves.map((move) => {
              const done = move.steps.filter((step) => step.done).length;
              return (
                <li key={move.id} className="flex flex-wrap items-center gap-3 px-2 py-1">
                  <div className="min-w-0 flex-[1_1_200px]">
                    <PersonLink
                      id={move.staff.id}
                      name={move.staff.name}
                      sub={t(move.kind === 'entry' ? 'move.firstDay' : 'move.lastDay', {
                        day: f.dateShort(dayOf(move.day)),
                      })}
                    />
                  </div>
                  <Chip tone={move.kind === 'entry' ? 'primary' : 'warn'} small>
                    {t(`move.${move.kind}`)}
                  </Chip>
                  <div className="flex w-40 flex-col gap-1">
                    <ProgressBar
                      size="sm"
                      value={move.steps.length ? Math.round((done / move.steps.length) * 100) : 0}
                      tone={done === move.steps.length ? 'good' : 'primary'}
                    />
                    <span className="text-xs text-text-2">
                      {t('move.progress', { done: n(done), total: n(move.steps.length) })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
      <SectionCard id="hr-ending" title={t('today.ending')} subtitle={t('today.endingHint')}>
        {data.ending.length === 0 ? (
          <EmptyState variant="inset">{t('today.noEnding')}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 px-3 pb-3">
            {data.ending.map((row) => (
              <li key={row.staff.id} className="flex flex-wrap items-center gap-3 px-2 py-1">
                <div className="min-w-0 flex-1">
                  <PersonLink
                    id={row.staff.id}
                    name={row.staff.name}
                    sub={f.date(dayOf(row.end))}
                  />
                </div>
                <Chip tone={CONTRACT_TONE[row.kind]} small>
                  {t(`contract.${row.kind}`)}
                </Chip>
                <span className="text-sm font-semibold text-warn">
                  {t('today.inDays', { n: n(daysUntil(row.end)) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageStack>
  );

  const aside = (
    <PageStack>
      <Card aria-label={t('today.attendance')} className="flex flex-col gap-3 p-5">
        <h2 className="m-0 text-base font-bold">{t('today.attendance')}</h2>
        <dl className="m-0 grid grid-cols-2 gap-3">
          {ATTENDANCE.map((key) => (
            <div key={key} className="flex flex-col gap-0.5 rounded-xl bg-canvas p-3">
              <dt className="text-xs text-text-2">{t(`attendance.${key}`)}</dt>
              <dd className="m-0 text-xl font-bold">{n(attendance[key])}</dd>
            </div>
          ))}
        </dl>
        {counts.no_device > 0 && (
          <p className="m-0 text-xs text-warn">{t('today.noDevice', { n: n(counts.no_device) })}</p>
        )}
      </Card>
      <SectionCard id="hr-birthdays" title={t('today.birthdays')} variant="panel">
        {data.birthdays.length === 0 ? (
          <EmptyState variant="inset">{t('today.noBirthdays')}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 px-3 pb-3">
            {data.birthdays.map((row) => (
              <li key={row.staff.id} className="px-2">
                <PersonLink
                  id={row.staff.id}
                  name={row.staff.name}
                  sub={
                    daysUntil(row.day) === 0
                      ? t('today.birthdayToday')
                      : f.dateShort(dayOf(row.day))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageStack>
  );

  return (
    <PageStack>
      <PageHeader title={t('today.title')} subtitle={t('today.subtitle')} />
      <StatGrid
        label={t('today.counts')}
        stats={[
          { label: t('today.total'), value: n(counts.total) },
          { label: t('state.trial'), value: n(counts.trial), tone: 'primary' },
          { label: t('state.joining'), value: n(counts.joining), tone: 'good' },
          { label: t('state.leaving'), value: n(counts.leaving), tone: 'urgent' },
        ]}
      />
      <PageColumns main={main} aside={aside} asideLabel={t('today.aside')} />
    </PageStack>
  );
}
