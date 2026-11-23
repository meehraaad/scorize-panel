import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { PageColumns } from '@/components/ui/PageColumns';
import { Pager } from '@/components/ui/Pager';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { pagesOf } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  mailWorkspaceQuery,
  useSendCustomerMail,
  type MailFolder,
  type MailMessage,
} from './serviceToolsApi';

const FOLDERS: MailFolder[] = ['all', 'inbox', 'sent', 'unread'];
type Draft = { recipient: string; subject: string; body: string; reply_to?: string };

export function CustomerMailTool({ address }: { address: { customer: number; service: number } }) {
  const { t } = useTranslation('executive');
  const f = useFormat();
  const [folder, setFolder] = useState<MailFolder>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const { data, isPlaceholderData, error } = useQuery(mailWorkspaceQuery(address, folder, page));
  const send = useSendCustomerMail(address);
  if (error && !data) throw error;
  return (
    <PageColumns
      asideLabel={t('workspace.mail.title')}
      aside={
        <SectionCard id="customer-mail-index" title={t('workspace.mail.title')} variant="panel">
          <FilterTabs<MailFolder>
            label={t('workspace.mail.title')}
            value={folder}
            options={FOLDERS.map((value) => ({
              value,
              label: t(`workspace.mail.folder.${value}`),
            }))}
            onChange={(value) => {
              setFolder(value);
              setPage(1);
              setSelected(null);
            }}
          />
          {!data || isPlaceholderData ? (
            <SkeletonRows rows={4} />
          ) : data.results.length === 0 ? (
            <EmptyState>{t('workspace.mail.empty')}</EmptyState>
          ) : (
            <ul className="m-0 list-none divide-y divide-hair p-0">
              {data.results.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full flex-col rounded-lg p-2 text-start hover:bg-canvas"
                    aria-pressed={message.id === selected?.id}
                    onClick={() => {
                      setSelected(message);
                      setDraft(null);
                    }}
                  >
                    <strong>{message.subject}</strong>
                    <span className="text-label text-text-2">
                      {message.name || message.contact}
                    </span>
                    {message.at && (
                      <time dateTime={message.at} className="text-label text-text-2">
                        {f.timeAgo(message.at)}
                      </time>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pagesOf(data) > 1 && (
            <Pager
              inset
              page={page}
              pages={pagesOf(data)}
              pending={isPlaceholderData}
              onPage={setPage}
            />
          )}
        </SectionCard>
      }
      main={
        <SectionCard
          id="customer-mail-message"
          variant="panel"
          title={
            draft ? t('workspace.mail.new') : (selected?.subject ?? t('workspace.mail.message'))
          }
          end={
            data?.can_send && (
              <Button
                variant="outline"
                onClick={() => setDraft({ recipient: '', subject: '', body: '' })}
              >
                {t('workspace.mail.new')}
              </Button>
            )
          }
        >
          {draft ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                send.mutate(draft, {
                  onSuccess: () => {
                    setDraft(null);
                    toast.success(t('workspace.mail.queued'));
                  },
                  onError: () => toast.error(t('workspace.saveError')),
                });
              }}
            >
              <TextField
                type="email"
                label={t('workspace.mail.recipient')}
                value={draft.recipient}
                required
                readOnly={!!draft.reply_to}
                onChange={(event) => setDraft({ ...draft, recipient: event.target.value })}
              />
              <TextField
                label={t('workspace.mail.subject')}
                value={draft.subject}
                maxLength={512}
                required
                onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
              />
              <TextAreaField
                label={t('workspace.mail.body')}
                value={draft.body}
                maxLength={20000}
                required
                rows={7}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={send.isPending || !data?.can_send}>
                  {t('workspace.mail.send')}
                </Button>
                <Button variant="outline" onClick={() => setDraft(null)}>
                  {t('workspace.mail.cancel')}
                </Button>
              </div>
            </form>
          ) : selected ? (
            <div className="flex flex-col gap-3">
              <span dir="auto" className="text-small text-text-2">
                {selected.contact}
              </span>
              <p dir="auto" className="m-0 wrap-anywhere whitespace-pre-wrap">
                {selected.body}
              </p>
              {data?.can_send && selected.incoming && (
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() =>
                    setDraft({
                      recipient: selected.contact,
                      subject: t('workspace.mail.replySubject', { subject: selected.subject }),
                      body: '',
                      reply_to: selected.id,
                    })
                  }
                >
                  {t('workspace.mail.reply')}
                </Button>
              )}
            </div>
          ) : (
            <EmptyState>{t('workspace.mail.choose')}</EmptyState>
          )}
        </SectionCard>
      }
    />
  );
}
