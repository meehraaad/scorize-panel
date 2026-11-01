import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { Pager } from '@/components/ui/Pager';
import { ProgressBar } from '@/components/ui/Progress';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import {
  FIRST_MAILBOXES,
  MAILBOX_PROBLEMS,
  mailboxesQuery,
  serversQuery,
  type Mailbox,
  type MailboxProblem,
} from '../api';
import { useSize } from '../format';
import { MailboxDialog } from './MailboxDialog';

const NEAR_FULL = 0.9;

/** The mailboxes, filtered by server, problem or a search; a row opens its dialog. */
export function MailboxList() {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const { data: servers } = useSuspenseQuery(serversQuery);
  const [server, setServer] = useState(FIRST_MAILBOXES.server);
  const [problem, setProblem] = useState<MailboxProblem | ''>(FIRST_MAILBOXES.problem);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const filters = { server, problem, search: useDebouncedValue(search.trim()), page };
  const { data, isPlaceholderData } = useQuery(mailboxesQuery(filters));
  const pages = pagesOf(data);
  useClampPage(data, page, setPage);

  return (
    <Card aria-label={t('list.label')} aria-busy={!data || isPlaceholderData}>
      <div className="flex flex-wrap items-end gap-3 px-5 pt-5 lg:px-8">
        <SearchField
          label={t('list.search')}
          placeholder={t('list.searchPlaceholder')}
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        {servers.length > 1 && (
          <SelectField
            inline
            label={t('list.server')}
            value={server}
            onChange={(value) => {
              setServer(value);
              setPage(1);
            }}
            options={[
              { value: '', label: t('list.allServers') },
              ...servers.map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        )}
        <SelectField<MailboxProblem | ''>
          inline
          label={t('list.problem')}
          value={problem}
          onChange={(value) => {
            setProblem(value);
            setPage(1);
          }}
          options={[
            { value: '', label: t('list.allProblems') },
            ...MAILBOX_PROBLEMS.map((value) => ({ value, label: t(`problem.${value}`) })),
          ]}
        />
        {data && (
          <span className="ms-auto text-sm text-text-2">
            {t('list.count', { n: f.number(data.count) })}
          </span>
        )}
      </div>
      {!data ? (
        <SkeletonRows rows={6} />
      ) : data.results.length === 0 ? (
        <EmptyState variant="padded">{t('list.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none p-0 pt-3">
          {data.results.map((mailbox) => (
            <li key={mailbox.id}>
              <MailboxRow mailbox={mailbox} onOpen={() => setOpen(mailbox.id)} />
            </li>
          ))}
        </ul>
      )}
      {data && data.count > 0 && (
        <Pager page={page} pages={pages} pending={isPlaceholderData} onPage={setPage} />
      )}
      {open !== null && <MailboxDialog id={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function MailboxRow({ mailbox, onOpen }: { mailbox: Mailbox; onOpen: () => void }) {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const size = useSize();
  const share = mailbox.quota_mb ? Math.min(1, mailbox.used_mb / mailbox.quota_mb) : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('list.open', { address: mailbox.address })}
      className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-start shadow-[inset_0_1px_0_var(--hair)] hover:bg-canvas lg:px-8"
    >
      <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">
          <bdi>{mailbox.address}</bdi>
        </span>
        <span className="text-[13px] text-text-2">
          {mailbox.applicant
            ? `${mailbox.applicant.name}${
                mailbox.applicant.file_number === null
                  ? ''
                  : ` · ${t('list.file', { n: f.number(mailbox.applicant.file_number) })}`
              }`
            : t('list.noApplicant')}
        </span>
      </span>
      <span className="flex flex-[0_1_200px] flex-col gap-1.5">
        <span className="text-[13px] text-text-2">
          {mailbox.quota_mb
            ? t('list.usage', { used: size(mailbox.used_mb), quota: size(mailbox.quota_mb) })
            : t('list.usageNoQuota', { used: size(mailbox.used_mb) })}
        </span>
        {mailbox.quota_mb !== null && (
          <ProgressBar
            size="sm"
            value={Math.round(share * 100)}
            tone={share >= NEAR_FULL ? 'warn' : 'primary'}
          />
        )}
      </span>
      <span className="flex flex-[1_1_200px] flex-wrap items-center gap-1.5">
        {mailbox.use_for_bot && (
          <Chip tone="primary" small>
            {t('list.bot')}
          </Chip>
        )}
        {mailbox.use_for_writing && (
          <Chip tone="info" small>
            {t('list.writing')}
          </Chip>
        )}
        {mailbox.problems.map((problem) => (
          <Chip key={problem} tone={problem === 'login_failed' ? 'danger' : 'warn'} small>
            {t(`problem.${problem}`)}
          </Chip>
        ))}
      </span>
      <Icon name="chevronEnd" size={18} className="text-text-3" />
    </button>
  );
}
