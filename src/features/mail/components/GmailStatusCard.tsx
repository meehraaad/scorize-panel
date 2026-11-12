import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useFormat } from '@/lib/i18n/useFormat';
import { gmailStatusQuery } from '../api';
import type { GmailAccountFilter } from '../gmailApi';
import { GmailAccountsDialog } from './GmailAccountsDialog';

export function GmailStatusCard() {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const { data } = useQuery(gmailStatusQuery);
  const [view, setView] = useState<GmailAccountFilter | null>(null);
  if (!data) return null;

  const stats = [
    { filter: 'all', label: t('gmail.botMailboxes'), value: data.bot_mailboxes },
    { filter: 'login_failed', label: t('gmail.loginFailed'), value: data.login_failed },
    { filter: 'queued', label: t('gmail.queued'), value: data.queued },
  ] as const;

  return (
    <Card aria-labelledby="gmail-status" className="flex flex-col gap-4 p-5 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 id="gmail-status" className="m-0 text-lg font-bold">
          {t('gmail.name')}
        </h2>
        <Chip tone={data.is_active ? 'good' : 'neutral'} small>
          {t(data.is_active ? 'gmail.enabled' : 'servers.inactive')}
        </Chip>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5 p-2">
          <dt className="text-[13px] text-text-2">{t('gmail.firstEmailsToday')}</dt>
          <dd className="m-0 text-lg font-bold tabular-nums">
            {f.number(data.first_emails_today)}
          </dd>
        </div>
        {stats.map(({ filter, label, value }) => (
          <div key={filter} className="flex flex-col gap-0.5 rounded-xl bg-canvas p-2">
            <dt className="text-[13px] text-text-2">{label}</dt>
            <dd className="m-0">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={t('gmail.openMetric', { label, count: f.number(value) })}
                className="min-h-11 min-w-11 cursor-pointer text-start text-lg font-bold text-primary tabular-nums underline underline-offset-4"
                onClick={() => setView(filter)}
              >
                {f.number(value)}
              </button>
            </dd>
          </div>
        ))}
      </dl>
      {view && <GmailAccountsDialog initialView={view} onClose={() => setView(null)} />}
    </Card>
  );
}
