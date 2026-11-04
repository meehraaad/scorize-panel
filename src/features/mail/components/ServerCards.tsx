import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { botRulesQuery, serversQuery, useRefreshServer, type MailServer } from '../api';
import { useFailure } from '../format';

/** Days before the certificate's end when the card warns. */
const CERTIFICATE_WARN_DAYS = 21;

/** Each mail server's health from its last read: disk, queue, today's mail, the certificate. */
export function ServerCards() {
  const { t } = useTranslation('mail');
  const { data } = useSuspenseQuery(serversQuery);
  // A server with this many "poor reputation" rejects today pauses its bots.
  const { data: rules } = useSuspenseQuery(botRulesQuery);
  if (data.length === 0) return <EmptyState variant="card">{t('servers.empty')}</EmptyState>;
  return (
    <section aria-label={t('servers.label')} className="grid gap-4 lg:grid-cols-2">
      {data.map((server) => (
        <ServerCard key={server.id} server={server} pauseAt={rules.reputation_pause_rejects} />
      ))}
    </section>
  );
}

function ServerCard({ server, pauseAt }: { server: MailServer; pauseAt: number }) {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const refresh = useRefreshServer();
  const failure = useFailure();
  const [now] = useState(() => Date.now());
  const titleId = `server-${String(server.id)}`;
  const value = (n: number | null) => (n === null ? t('dash') : f.number(n));
  const certificateSoon =
    server.certificate_expires_at !== null &&
    new Date(server.certificate_expires_at).getTime() - now <
      CERTIFICATE_WARN_DAYS * 24 * 3600 * 1000;
  const rejects = server.today.reputation_rejects ?? 0;

  const stats = [
    { key: 'mailboxes', label: t('servers.mailboxes'), value: value(server.mailboxes) },
    {
      key: 'disk',
      label: t('servers.disk'),
      value:
        server.disk_used_percent === null ? t('dash') : `${f.number(server.disk_used_percent)}٪`,
    },
    { key: 'queue', label: t('servers.queue'), value: value(server.queue) },
    { key: 'sent', label: t('servers.sent'), value: value(server.today.sent) },
    { key: 'bounced', label: t('servers.bounced'), value: value(server.today.bounced) },
    { key: 'rejects', label: t('servers.rejects'), value: value(server.today.reputation_rejects) },
  ];

  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-4 p-5 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className="m-0 text-lg font-bold">
            {server.name}
          </h2>
          <span className="text-sm text-text-2">
            <bdi>{server.domain}</bdi>
            {server.checked_at &&
              ` · ${t('servers.checked', { when: f.timeAgo(server.checked_at) })}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!server.is_active ? (
            <Chip tone="neutral" small>
              {t('servers.inactive')}
            </Chip>
          ) : server.error ? (
            <Chip tone="danger" small>
              {t('servers.failed')}
            </Chip>
          ) : server.checked_at ? (
            <Chip tone="good" small>
              {t('servers.ok')}
            </Chip>
          ) : (
            <Chip tone="neutral" small>
              {t('servers.never')}
            </Chip>
          )}
          <IconButton
            icon="retry"
            tone="muted"
            aria-label={t('servers.refresh', { name: server.name })}
            disabled={refresh.isPending}
            onClick={() =>
              refresh.mutate(server.id, {
                onSuccess: (fresh) =>
                  fresh.error
                    ? toast.error(t('servers.error', { error: fresh.error }))
                    : toast.success(t('servers.refreshed', { name: server.name })),
                onError: (error) => toast.error(failure(error)),
              })
            }
          />
        </div>
      </div>
      <dl className="m-0 grid grid-cols-3 gap-x-3 gap-y-3">
        {stats.map((stat) => (
          <div key={stat.key} className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-text-2">{stat.label}</dt>
            <dd className="m-0 text-lg font-bold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      {server.certificate_expires_at && (
        <p className={`m-0 text-[13px] ${certificateSoon ? 'text-danger' : 'text-text-2'}`}>
          {t(certificateSoon ? 'servers.certificateSoon' : 'servers.certificate', {
            date: f.date(server.certificate_expires_at),
          })}
        </p>
      )}
      {server.error && <Notice tone="error">{t('servers.error', { error: server.error })}</Notice>}
      {rejects >= pauseAt && (
        <Notice tone="warn">{t('servers.rejectsHigh', { n: f.number(rejects) })}</Notice>
      )}
    </Card>
  );
}
