import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReportPeriod, type ReportDays } from '@/components/ui/ReportPeriod';
import { ReportTable } from '@/components/ui/ReportTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { siteHealthQuery, type SiteHealth } from './api';

const metrics = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const;
const dependencies = ['database', 'session_cache'] as const;
const queues = ['celery', 'realtime', 'ai'] as const;
const providers = ['login_sms', 'payment_start', 'payment_verify'] as const;
const stateTone = { up: 'good', down: 'danger', stale: 'warn', unknown: 'neutral' } as const;
const vitalTone = { good: 'good', 'needs-improvement': 'warn', poor: 'danger' } as const;

export default function SiteHealthPage() {
  const { t } = useTranslation('telemetry');
  const f = useFormat();
  const [days, setDays] = useState<ReportDays>(7);
  const report = useQuery(siteHealthQuery(days));
  const data = report.data;
  return (
    <PageStack>
      <PageHeader
        title={t('health.title')}
        subtitle={data ? t('health.updated', { at: f.dateTime(data.checked_at) }) : undefined}
        actions={
          <ReportPeriod
            days={days}
            change={setDays}
            busy={report.isFetching}
            refresh={() => void report.refetch()}
          />
        }
      />
      {report.isError && <Notice tone="error">{t('failed')}</Notice>}
      {report.isPending && <SkeletonRows rows={5} />}
      {data && <HealthOverview data={data} />}
    </PageStack>
  );
}

function HealthOverview({ data }: { data: SiteHealth }) {
  const { t } = useTranslation('telemetry');
  const f = useFormat();
  const missing = t('missing');
  const milliseconds = (value: number | null) =>
    value === null ? missing : t('health.milliseconds', { value: f.number(Math.round(value)) });
  const when = (value: string | null) => (value ? f.dateTime(value) : missing);
  const state = (status: keyof typeof stateTone) => (
    <Chip tone={stateTone[status]}>{t(`health.state.${status}`)}</Chip>
  );
  const availability = (passed: number, checks: number) =>
    checks
      ? t('health.percent', { value: f.number(Math.round((1000 * passed) / checks) / 10) })
      : missing;
  return (
    <>
      <StatGrid
        label={t('health.summary')}
        compact
        stats={[
          ...data.surfaces.map((surface) => ({
            label: t('health.errorRate', { surface: t(`health.targets.${surface.surface}`) }),
            value: availability(surface.sampled_errors, surface.samples),
            note: t('health.sampled', { value: f.number(surface.samples) }),
            tone: surface.errors > 0 ? ('urgent' as const) : ('default' as const),
          })),
          ...providers.map((provider) => ({
            label: t(`health.providers.${provider}`),
            value:
              data.provider_failures_last_hour[provider] == null
                ? missing
                : f.number(data.provider_failures_last_hour[provider]),
            note: t('health.lastHour'),
          })),
          { label: t('health.crashes'), value: f.number(data.crash_count) },
        ]}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[2fr_1fr]">
        <SectionCard id="site-probes" title={t('health.probes')}>
          <ReportTable
            labelledBy="site-probes"
            columns={[
              t('health.target'),
              t('health.status'),
              t('health.availability'),
              t('health.lastCheck'),
            ]}
            rows={data.probes.map((probe) => ({
              key: probe.target,
              cells: [
                t(`health.targets.${probe.target}`),
                state(probe.state),
                <span
                  key="availability"
                  title={t('health.sampled', { value: f.number(probe.checks) })}
                >
                  {availability(probe.passed, probe.checks)}
                </span>,
                <div key="check" className="whitespace-nowrap">
                  {when(probe.checked_at)}
                  <div className="text-text-2">{milliseconds(probe.duration_ms)}</div>
                </div>,
              ],
            }))}
          />
        </SectionCard>
        <SectionCard id="site-dependencies" title={t('health.dependencies')} variant="panel">
          <dl className="m-0 divide-y divide-hair">
            {dependencies.map((name) => (
              <div key={name} className="flex justify-between gap-3 py-2">
                <dt>{t(`health.dependenciesNames.${name}`)}</dt>
                <dd className="m-0">{state(data.dependencies[name] ? 'up' : 'down')}</dd>
              </div>
            ))}
            {queues.map((queue) => {
              const at = data.queues[queue];
              const stale = at && Date.parse(data.checked_at) - Date.parse(at) > 180_000;
              return (
                <div key={queue} className="flex justify-between gap-3 py-2">
                  <dt>{t(`health.dependenciesNames.${queue}`)}</dt>
                  <dd className="m-0 text-end">
                    {state(at ? (stale ? 'stale' : 'up') : 'unknown')}
                    {at && <div className="mt-1 text-sm text-text-2">{when(at)}</div>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </SectionCard>
      </div>
      <SectionCard id="site-routes" title={t('health.routes')} subtitle={t('health.routesNote')}>
        <ReportTable
          labelledBy="site-routes"
          columns={[
            t('health.target'),
            t('health.route'),
            t('health.p95'),
            t('health.samples'),
            t('health.errors'),
            t('health.supportCode'),
          ]}
          rows={data.routes.map((row) => ({
            key: `${row.surface}/${row.route}`,
            cells: [
              t(`health.targets.${row.surface}`),
              <bdi key="route">{row.route}</bdi>,
              milliseconds(row.p95_ms),
              f.number(row.samples),
              f.number(row.errors),
              <bdi key="code" className="font-mono">
                {row.support_code || missing}
              </bdi>,
            ],
          }))}
        />
      </SectionCard>
      <SectionCard id="site-vitals" title={t('health.vitals')} subtitle={t('health.vitalsNote')}>
        <ReportTable
          labelledBy="site-vitals"
          columns={[t('health.page'), ...metrics]}
          rows={data.vitals.map((row) => ({
            key: row.page,
            cells: [
              <bdi key="page">{row.page}</bdi>,
              ...metrics.map((name) => {
                const value = row.metrics[name];
                return value ? (
                  <div key={name} className="whitespace-nowrap">
                    <Chip tone={vitalTone[value.rating]}>
                      {name === 'CLS' ? f.number(value.p75) : milliseconds(value.p75)}
                    </Chip>
                    <div className="mt-1 text-xs text-text-2">
                      {t('health.sampled', { value: f.number(value.count) })}
                    </div>
                  </div>
                ) : (
                  missing
                );
              }),
            ],
          }))}
        />
      </SectionCard>
      <SectionCard id="site-crashes" title={t('health.crashes')}>
        <ReportTable
          labelledBy="site-crashes"
          columns={[
            t('health.target'),
            t('health.page'),
            t('health.release'),
            t('health.errors'),
            t('health.lastSeen'),
            t('health.supportCode'),
          ]}
          rows={data.crashes.map((row) => ({
            key: [row.surface, row.page, row.build, row.fingerprint].join('/'),
            cells: [
              t(`health.targets.${row.surface}`),
              <bdi key="page">{row.page}</bdi>,
              <bdi key="release">{row.build || missing}</bdi>,
              f.number(row.count),
              when(row.last_at),
              <bdi key="code" className="font-mono">
                {row.support_code || missing}
              </bdi>,
            ],
          }))}
        />
      </SectionCard>
    </>
  );
}
