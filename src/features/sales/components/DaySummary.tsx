import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { DayReport } from '../api';
import { customerPath } from '../paths';

/**
 * What one day held (S59): how many sessions of each consultation type and how many logged
 * contacts of each kind, then the contacts themselves. The day's sessions are listed below it.
 */
export function DaySummary({ report }: { report: DayReport }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const sessions = report.sessions.reduce((sum, row) => sum + row.count, 0);
  return (
    <SectionCard
      id="consultations-day"
      title={t('consultations.dayReport.title')}
      subtitle={t('consultations.dayReport.subtitle', {
        sessions: f.number(sessions),
        contacts: f.number(report.contacts.length),
      })}
    >
      <ul
        aria-label={t('consultations.dayReport.counts')}
        className="m-0 flex list-none flex-wrap gap-2 px-5 pb-4 lg:px-8"
      >
        {report.sessions.map((row) => (
          <li key={`type-${row.type}`}>
            <Chip tone="info" small>
              {t('consultations.dayReport.count', { label: row.type, n: f.number(row.count) })}
            </Chip>
          </li>
        ))}
        {report.kinds.map((row) => (
          <li key={`kind-${row.kind}`}>
            <Chip tone="neutral" small>
              {t('consultations.dayReport.count', {
                label: t(`consultations.dayReport.kind.${row.kind}`),
                n: f.number(row.count),
              })}
            </Chip>
          </li>
        ))}
      </ul>
      {report.contacts.length === 0 ? (
        <EmptyState>{t('consultations.dayReport.empty')}</EmptyState>
      ) : (
        <ol className="m-0 list-none p-0">
          {report.contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-5 py-3 shadow-[inset_0_1px_0_var(--hair)] lg:flex-nowrap lg:px-8"
            >
              <time dateTime={contact.at} className="w-14 flex-none text-sm font-bold tabular-nums">
                {f.time(contact.at)}
              </time>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px]">
                  <Link
                    to={customerPath(contact.customer)}
                    className="font-semibold text-text hover:underline"
                  >
                    {contact.name}
                  </Link>
                  {' · '}
                  {t(`consultations.dayReport.kind.${contact.kind}`)}
                  {contact.author ? ` · ${contact.author}` : ''}
                </span>
                {contact.text && (
                  <span className="text-sm leading-7 break-words text-text-2">{contact.text}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {report.more && (
        <p className="m-0 px-5 py-3 text-sm text-text-2 lg:px-8">
          {t('consultations.dayReport.more')}
        </p>
      )}
    </SectionCard>
  );
}
