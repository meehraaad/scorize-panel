import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { useFailure } from '../format';
import { gmailQueueQuery, type GmailAccount } from '../gmailApi';

export function GmailRecipientQueue({
  account,
  onBack,
}: {
  account: GmailAccount;
  onBack: () => void;
}) {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const failure = useFailure();
  const [page, setPage] = useState(1);
  const { data, error } = useQuery(gmailQueueQuery(account.id, page));
  useClampPage(data, page, setPage);

  return (
    <section className="flex flex-col gap-4" aria-label={t('gmail.openQueue')}>
      <Button variant="outline" className="self-start" onClick={onBack}>
        {t('gmail.backToAccounts')}
      </Button>
      <div>
        <h3 className="m-0 text-base font-bold">{account.applicant.name}</h3>
        <bdi className="text-sm text-text-2">{account.address}</bdi>
        {data && (
          <p className="m-0 text-sm text-text-2">
            {t('gmail.queueCount', { count: f.number(data.count) })}
          </p>
        )}
      </div>
      {error ? (
        <Notice tone="error">{failure(error)}</Notice>
      ) : !data ? (
        <SkeletonRows rows={4} />
      ) : data.results.length === 0 ? (
        <EmptyState variant="padded">{t('gmail.emptyQueue')}</EmptyState>
      ) : (
        <ul className="m-0 list-none divide-y divide-line-2 p-0">
          {data.results.map((recipient) => (
            <li key={recipient.id} className="flex flex-col items-start gap-1 py-3 text-sm">
              <span className="font-semibold">{recipient.name}</span>
              <bdi className="[overflow-wrap:anywhere]">{recipient.address}</bdi>
              {recipient.university && <span className="text-text-2">{recipient.university}</span>}
              <div className="flex flex-wrap gap-1">
                <Chip tone="neutral" small>
                  {t(`gmail.source.${recipient.source}`)}
                </Chip>
                {!recipient.source_allowed && (
                  <Chip tone="warn" small>
                    {t('gmail.reason.source_restricted')}
                  </Chip>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {pagesOf(data) > 1 && <Pager inset page={page} pages={pagesOf(data)} onPage={setPage} />}
    </section>
  );
}
