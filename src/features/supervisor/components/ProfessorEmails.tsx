import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { professorEmailsQuery, type ProfessorEmailStatus } from '../api';

const EMAIL_TONE: Record<ProfessorEmailStatus, ChipTone> = {
  queued: 'neutral',
  sent: 'info',
  reminded: 'primary',
  replied: 'good',
  bounced: 'danger',
};

/** The emails the professor bot sent, a page at a time (the applications tab, the correspondence service). */
export function ProfessorEmails({ caseId, replied }: { caseId: number; replied: number }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useQuery(professorEmailsQuery(caseId, page));
  const pages = pagesOf(data);

  return (
    <Card aria-label={t('applications.view.emails')} aria-busy={!data || isPlaceholderData}>
      <p className="m-0 px-5 pt-5 text-sm text-text-2 lg:px-8">
        {t('emails.replied', { n: f.number(replied) })}
      </p>
      {!data ? (
        <SkeletonRows rows={5} />
      ) : data.results.length === 0 ? (
        <EmptyState variant="padded">{t('emails.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none p-0 pt-2">
          {data.results.map((email) => (
            <li
              key={email.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                <span className="text-[15px] font-semibold">
                  <bdi>{email.professor}</bdi>
                </span>
                <span className="text-[13px] text-text-2">
                  <bdi>{email.university}</bdi>
                </span>
              </span>
              <span className="flex-[0_0_140px] text-sm text-text-2">
                {email.sent_at ? f.date(email.sent_at) : t('dash')}
              </span>
              <Chip tone={EMAIL_TONE[email.status]} small>
                {t(`emails.status.${email.status}`)}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      {data && data.count > 0 && (
        <Pager page={page} pages={pages} pending={isPlaceholderData} onPage={setPage} />
      )}
    </Card>
  );
}
