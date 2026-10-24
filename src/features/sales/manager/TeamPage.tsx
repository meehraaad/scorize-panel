import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/buttonStyles';
import { SelectField } from '@/components/ui/Choices';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { StatGrid } from '@/components/ui/StatGrid';
import { FIRST_CALL_TARGET_MINUTES } from '@/lib/sales/api';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import { teamExportHref, teamQuery, type TeamAlert, type TeamData, type TeamRange } from '../api';
import { useSalesFormat } from '../format';
import { salesPath } from '../paths';

const RANGES = ['month', 'last', 'quarter'] as const satisfies readonly TeamRange[];
const LEADERBOARD = [
  'rank',
  'seller',
  'won',
  'sales',
  'conversion',
  'firstCall',
  'overdue',
] as const;
const SOURCE_COLUMNS = ['source', 'leads', 'won', 'rate', 'sales'] as const;
/** A seller this slow to call, or with this many overdue follow-ups, is flagged. */
const SLOW_MINUTES = 25;
const MANY_OVERDUE = 3;

/** The team's month: targets, a leaderboard, alerts and which lead sources sell. */
export default function TeamPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const [range, setRange] = useState<TeamRange>('month');
  const { data } = useQuery(teamQuery(range));

  return (
    <>
      <PageHeader
        title={t('manager.team.title', { month: data ? f.monthYear(data.from) : '' })}
        subtitle={
          data &&
          t('manager.team.subtitle', { won: f.number(data.won), target: f.number(data.target) })
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SelectField
              inline
              label={t('manager.team.range')}
              value={range}
              onChange={setRange}
              options={RANGES.map((value) => ({
                value,
                label: t(`manager.team.rangeOption.${value}`),
              }))}
            />
            <a href={teamExportHref(range)} className={buttonClass('outline')}>
              <Icon name="download" size={18} />
              {t('manager.team.export')}
            </a>
          </div>
        }
      />
      {!data ? (
        <SkeletonRows rows={6} />
      ) : (
        <>
          <StatGrid
            label={t('manager.team.kpis')}
            stats={[
              {
                label: t('manager.team.won'),
                value: f.number(data.won),
                note: t('manager.team.wonNote', {
                  target: f.number(data.target),
                  days: f.number(data.days_left),
                }),
              },
              {
                label: t('manager.team.sales'),
                value: s.millions(data.sales),
                tone: data.sales_change >= 0 ? 'good' : 'urgent',
                note: t(data.sales_change >= 0 ? 'manager.team.up' : 'manager.team.down', {
                  n: s.percent(Math.abs(data.sales_change)),
                }),
              },
              {
                label: t('manager.team.conversion'),
                value: s.percent(data.conversion),
                note: t('manager.team.before', { n: s.percent(data.conversion_before) }),
              },
              {
                label: t('manager.team.firstCall'),
                value: s.minutes(data.first_call_minutes),
                tone: data.first_call_minutes > FIRST_CALL_TARGET_MINUTES ? 'urgent' : 'good',
                note: t('manager.team.goal', { n: s.minutes(FIRST_CALL_TARGET_MINUTES) }),
              },
            ]}
          />
          <Leaderboard data={data} />
          {data.alerts.length > 0 && <Alerts alerts={data.alerts} />}
          <Sources data={data} />
        </>
      )}
    </>
  );
}

const cell = 'px-3 py-3.5 first:ps-5 last:pe-5 lg:first:ps-8 lg:last:pe-8';

function Leaderboard({ data }: { data: TeamData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  return (
    <SectionCard id="team-board" title={t('manager.team.leaderboard')}>
      <div className="overflow-x-auto pb-2">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-[13px] text-text-2">
              {LEADERBOARD.map((column) => (
                <th key={column} scope="col" className={`${cell} py-2 text-start font-medium`}>
                  {t(`manager.team.column.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sellers.map((seller, index) => (
              <tr key={seller.id} className="shadow-[inset_0_1px_0_var(--hair)]">
                <td className={`${cell} font-bold text-text-2`}>{f.number(index + 1)}</td>
                <th scope="row" className={`${cell} text-start font-semibold`}>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={seller.name} size="sm" />
                    {seller.name}
                  </span>
                </th>
                <td className={cell}>
                  <span className="flex flex-col gap-1.5">
                    {t('manager.team.ofTarget', {
                      won: f.number(seller.won),
                      target: f.number(seller.target),
                    })}
                    <ProgressBar
                      value={percentOf(seller.won, seller.target)}
                      size="sm"
                      className="w-28"
                    />
                  </span>
                </td>
                <td className={`${cell} tabular-nums`}>{s.millions(seller.sales)}</td>
                <td className={cell}>{s.percent(seller.conversion)}</td>
                <td
                  className={`${cell} ${seller.first_call_minutes > SLOW_MINUTES ? 'font-semibold text-urgent' : ''}`}
                >
                  {s.minutes(seller.first_call_minutes)}
                </td>
                <td
                  className={`${cell} ${seller.overdue >= MANY_OVERDUE ? 'font-semibold text-urgent' : ''}`}
                >
                  {f.number(seller.overdue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function Alerts({ alerts }: { alerts: TeamAlert[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const content = (alert: TeamAlert) => {
    switch (alert.kind) {
      case 'unattended':
        return {
          text: t('manager.team.alert.unattended', {
            seller: alert.seller,
            n: f.number(alert.count),
          }),
          to: salesPath('manager'),
        };
      case 'draft':
        return {
          text: t('manager.team.alert.draft', {
            customer: alert.customer,
            n: f.number(alert.discount),
          }),
          to: salesPath('manager/approvals'),
        };
      case 'no_offer':
        return {
          text: t('manager.team.alert.no_offer', { n: f.number(alert.count) }),
          to: salesPath('leads?stage=consulted'),
        };
    }
  };
  return (
    <SectionCard id="team-alerts" variant="panel" size="lg" title={t('manager.team.alerts')}>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {alerts.map((alert, index) => {
          const { text, to } = content(alert);
          return (
            <li
              key={index}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warn-tint px-4 py-3"
            >
              <span className="flex items-center gap-2.5 text-sm text-neutral">
                <span className="text-warn">
                  <Icon name="alert" size={18} />
                </span>
                {text}
              </span>
              <Link to={to} className="text-sm font-semibold text-primary-text">
                {t(`manager.team.alertAction.${alert.kind}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function Sources({ data }: { data: TeamData }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const best = Math.max(0.01, ...data.sources.map((row) => (row.leads ? row.won / row.leads : 0)));
  return (
    <SectionCard
      id="team-sources"
      title={t('manager.team.sources')}
      subtitle={t('manager.team.sourcesHint')}
    >
      <div className="overflow-x-auto pb-2">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-[13px] text-text-2">
              {SOURCE_COLUMNS.map((column) => (
                <th key={column} scope="col" className={`${cell} py-2 text-start font-medium`}>
                  {t(`manager.team.sourceColumn.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sources.map((row) => {
              const rate = row.leads ? row.won / row.leads : 0;
              return (
                <tr key={row.source} className="shadow-[inset_0_1px_0_var(--hair)]">
                  <th scope="row" className={`${cell} text-start font-medium`}>
                    {row.source === 'referral'
                      ? t('manager.team.referral')
                      : t(`source.${row.source}`)}
                  </th>
                  <td className={`${cell} tabular-nums`}>{f.number(row.leads)}</td>
                  <td className={`${cell} tabular-nums`}>{f.number(row.won)}</td>
                  <td className={cell}>
                    <span className="flex items-center gap-3">
                      <span aria-hidden="true" className="h-2 w-28 rounded-full bg-track">
                        <span
                          className="block h-2 rounded-full bg-primary"
                          style={{ width: `${String((rate / best) * 100)}%` }}
                        />
                      </span>
                      <span className="font-bold">{s.percent(rate)}</span>
                    </span>
                  </td>
                  <td className={`${cell} tabular-nums`}>
                    {row.sales ? s.millions(row.sales) : t('due.none')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
