import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { Notice } from '@/components/ui/Notice';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  GMAIL_ACCOUNT_FILTERS,
  gmailAccountsQuery,
  type GmailAccount,
  type GmailAccountFilter,
} from '../gmailApi';
import { useFailure } from '../format';
import { GmailRecipientQueue } from './GmailRecipientQueue';

export function GmailAccountsDialog({
  initialView,
  onClose,
}: {
  initialView: GmailAccountFilter;
  onClose: () => void;
}) {
  const { t } = useTranslation('mail');
  const [view, setView] = useState(initialView);
  const [page, setPage] = useState(1);
  const [queue, setQueue] = useState<GmailAccount | null>(null);
  const { data, error } = useQuery(gmailAccountsQuery(view, page));
  const failure = useFailure();
  useClampPage(data, page, setPage);

  return (
    <Dialog open onClose={onClose} title={t('gmail.details')} closeLabel={t('close')}>
      {queue ? (
        <GmailRecipientQueue key={queue.id} account={queue} onBack={() => setQueue(null)} />
      ) : (
        <div className="flex flex-col gap-4">
          <FilterTabs
            label={t('gmail.details')}
            value={view}
            options={GMAIL_ACCOUNT_FILTERS.map((value) => ({
              value,
              label: t(`gmail.filter.${value}`),
            }))}
            onChange={(value) => {
              setView(value);
              setPage(1);
            }}
          />
          {error ? (
            <Notice tone="error">{failure(error)}</Notice>
          ) : !data ? (
            <SkeletonRows rows={4} />
          ) : data.results.length === 0 ? (
            <EmptyState variant="padded">{t('gmail.noAccounts')}</EmptyState>
          ) : (
            <ul className="m-0 list-none divide-y divide-line-2 p-0">
              {data.results.map((account) => (
                <li key={account.id}>
                  <GmailAccountRow account={account} onQueue={() => setQueue(account)} />
                </li>
              ))}
            </ul>
          )}
          {pagesOf(data) > 1 && <Pager inset page={page} pages={pagesOf(data)} onPage={setPage} />}
        </div>
      )}
    </Dialog>
  );
}

function GmailAccountRow({ account, onQueue }: { account: GmailAccount; onQueue: () => void }) {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const error = account.last_login_error;
  const failed = account.reasons.includes('login_failed');

  return (
    <div className="flex flex-col gap-2 py-4 text-sm">
      <div>
        <p className="m-0 font-semibold">{account.applicant.name}</p>
        {account.applicant.file_number !== null && (
          <p className="m-0 text-text-2">
            {t('list.file', { n: f.number(account.applicant.file_number) })}
          </p>
        )}
        <bdi className="block [overflow-wrap:anywhere]">{account.address}</bdi>
      </div>
      {account.reasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {account.reasons.map((reason) => (
            <Chip key={reason} tone={reason === 'login_failed' ? 'danger' : 'warn'} small>
              {t(`gmail.reason.${reason}`)}
            </Chip>
          ))}
        </div>
      )}
      {failed && (
        <p className="m-0 text-text-2">
          {error
            ? t('gmail.lastLoginError', {
                when: f.dateTime(error.at),
                reason: t(`gmail.loginReason.${error.reason}`),
              })
            : t('gmail.noLoginLog')}
        </p>
      )}
      {account.reasons.includes('missing_templates') && (
        <p className="m-0 text-text-2">
          {t('gmail.templateCount', {
            count: f.number(account.template_count),
            required: f.number(account.required_templates),
          })}
        </p>
      )}
      <p className="m-0 text-text-2">
        {t('gmail.accountActivity', {
          sent: f.number(account.first_emails_today),
          queued: f.number(account.queued),
        })}
      </p>
      {account.source_eligible > 0 && account.source_eligible < account.queued && (
        <p className="m-0 text-text-2">
          {t('gmail.eligibleSource', {
            count: f.number(account.source_eligible),
            queued: f.number(account.queued),
          })}
        </p>
      )}
      {account.queued > 0 && account.next_round_at && (
        <p className="m-0 text-text-2">
          {t('gmail.nextRound', { when: f.dateTime(account.next_round_at) })}
        </p>
      )}
      {account.queued > 0 && (
        <Button variant="outline" className="self-start" onClick={onQueue}>
          {t('gmail.openQueue')}
        </Button>
      )}
    </div>
  );
}
