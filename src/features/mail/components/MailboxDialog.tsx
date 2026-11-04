import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  mailboxQuery,
  useChangeMailbox,
  useDeleteMailbox,
  useNewPassword,
  type MailboxChange,
  type MailboxDetail,
} from '../api';
import { quotaOf, useFailure } from '../format';
import { ApplicantPicker, PasswordReveal, QuotaField } from './fields';

/** One mailbox: who it is for, what it is used for, its quota, a new password, delete, history. */
export function MailboxDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useTranslation('mail');
  const { data } = useQuery(mailboxQuery(id));
  return (
    <Dialog
      open
      onClose={onClose}
      title={data?.address ?? t('list.label')}
      subtitle={data ? t('detail.server', { name: data.server.name }) : undefined}
      closeLabel={t('close')}
    >
      {data ? (
        <MailboxForm key={data.id} mailbox={data} onDeleted={onClose} />
      ) : (
        <SkeletonRows rows={4} />
      )}
    </Dialog>
  );
}

const quotaValue = (mb: number | null) => (mb === null ? 'none' : String(mb));

function MailboxForm({ mailbox, onDeleted }: { mailbox: MailboxDetail; onDeleted: () => void }) {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const failure = useFailure();
  const change = useChangeMailbox(mailbox.id);
  const newPassword = useNewPassword(mailbox.id);
  const remove = useDeleteMailbox(mailbox.id);
  const [applicant, setApplicant] = useState(mailbox.applicant);
  const [bot, setBot] = useState(mailbox.use_for_bot);
  const [writing, setWriting] = useState(mailbox.use_for_writing);
  const [quota, setQuota] = useState(quotaValue(mailbox.quota_mb));
  const [confirm, setConfirm] = useState<'password' | 'delete' | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  const edits: MailboxChange = {};
  if ((applicant?.id ?? null) !== (mailbox.applicant?.id ?? null))
    edits.applicant = applicant?.id ?? null;
  if (bot !== mailbox.use_for_bot) edits.use_for_bot = bot;
  if (writing !== mailbox.use_for_writing) edits.use_for_writing = writing;
  if (quota !== quotaValue(mailbox.quota_mb)) edits.quota_mb = quotaOf(quota) ?? null;
  const changed = Object.keys(edits).length > 0;
  const needApplicant = (bot || writing) && !applicant;

  return (
    <div className="flex flex-col gap-5">
      {mailbox.problems.includes('login_failed') && (
        <Notice tone="error">{t('problem.login_failed')}</Notice>
      )}
      <p className="m-0 text-sm text-text-2">
        {t('detail.sentToday', { n: f.number(mailbox.sent_today) })}
      </p>
      <ApplicantPicker
        value={applicant}
        onChange={setApplicant}
        error={needApplicant ? t('create.needApplicant') : undefined}
      />
      <div className="flex flex-col">
        <Switch
          label={t('use.bot')}
          description={t('use.botHint')}
          checked={bot}
          onChange={setBot}
        />
        <Switch
          label={t('use.writing')}
          description={t('use.writingHint')}
          checked={writing}
          onChange={setWriting}
        />
      </div>
      <QuotaField value={quota} onChange={setQuota} current={mailbox.quota_mb} />
      <Button
        className="self-start"
        disabled={!changed || needApplicant || change.isPending}
        onClick={() =>
          change.mutate(edits, {
            onSuccess: () => toast.success(t('detail.saved')),
            onError: (error) => toast.error(failure(error)),
          })
        }
      >
        {t('detail.save')}
      </Button>

      {password && <PasswordReveal password={password} />}

      {confirm === 'password' ? (
        <InlineConfirm
          message={t('password.confirm', { address: mailbox.address })}
          confirmLabel={t('password.confirmButton')}
          cancelLabel={t('cancel')}
          pending={newPassword.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            newPassword.mutate(undefined, {
              onSuccess: (answer) => {
                setPassword(answer.password);
                setConfirm(null);
                toast.success(t('password.done', { address: mailbox.address }));
              },
              onError: (error) => toast.error(failure(error)),
            })
          }
        />
      ) : confirm === 'delete' ? (
        <InlineConfirm
          message={t('detail.deleteConfirm', { address: mailbox.address })}
          confirmLabel={t('detail.deleteButton')}
          cancelLabel={t('cancel')}
          pending={remove.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            remove.mutate(undefined, {
              onSuccess: () => {
                toast.success(t('detail.deleted', { address: mailbox.address }));
                onDeleted();
              },
              onError: (error) => toast.error(failure(error)),
            })
          }
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setConfirm('password')}>
            {t('password.new')}
          </Button>
          <Button variant="danger" onClick={() => setConfirm('delete')}>
            {t('detail.delete')}
          </Button>
        </div>
      )}

      <section aria-labelledby={`history-${String(mailbox.id)}`} className="flex flex-col gap-2">
        <h3 id={`history-${String(mailbox.id)}`} className="m-0 text-base font-bold">
          {t('detail.history')}
        </h3>
        {mailbox.actions.length === 0 ? (
          <p className="m-0 text-sm text-text-2">{t('detail.noHistory')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {mailbox.actions.map((action) => (
              <li key={action.id} className="flex flex-col gap-0.5 text-sm">
                <span className="font-medium">
                  {t(`detail.action.${action.kind}`)}
                  {action.detail && (
                    <>
                      {' · '}
                      <bdi>{action.detail}</bdi>
                    </>
                  )}
                </span>
                <span className="text-[13px] text-text-2">
                  {t('detail.by', { who: action.by ?? t('dash'), when: f.timeAgo(action.at) })}
                </span>
                {!action.ok && (
                  <span className="text-[13px] text-danger">
                    {t('detail.failed', { error: action.error ?? t('dash') })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
