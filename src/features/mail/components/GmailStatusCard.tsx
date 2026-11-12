import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useFormat } from '@/lib/i18n/useFormat';
import { gmailStatusQuery } from '../api';

export function GmailStatusCard() {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const { data } = useQuery(gmailStatusQuery);
  if (!data) return null;

  const stats = [
    { label: t('gmail.firstEmailsToday'), value: data.first_emails_today },
    { label: t('gmail.botMailboxes'), value: data.bot_mailboxes },
    { label: t('gmail.loginFailed'), value: data.login_failed },
  ];

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
      <dl className="m-0 grid grid-cols-3 gap-3">
        {stats.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-text-2">{label}</dt>
            <dd className="m-0 text-lg font-bold tabular-nums">{f.number(value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
