import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import { serversQuery, useCreateMailbox, type MailboxApplicant } from '../api';
import { quotaOf, useFailure } from '../format';
import { ApplicantPicker, PasswordReveal, QuotaField } from './fields';

/** As `mail-admin` and Django accept: letters, digits and . _ -, starting and ending with a letter or digit. */
const LOCAL_PART = /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/i;

/** Makes a mailbox on one of our servers; the answer's password is shown here once. */
export function NewMailboxDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('mail');
  const { data: servers } = useSuspenseQuery(serversQuery);
  const active = servers.filter((server) => server.is_active);
  const create = useCreateMailbox();
  const failure = useFailure();
  const [serverId, setServerId] = useState(String(active[0]?.id ?? ''));
  const [local, setLocal] = useState('');
  const [applicant, setApplicant] = useState<MailboxApplicant | null>(null);
  const [quota, setQuota] = useState('default');
  const [bot, setBot] = useState(true);
  const [writing, setWriting] = useState(false);
  const [checked, setChecked] = useState(false);
  const [made, setMade] = useState<{ address: string; password: string } | null>(null);
  const server = active.find((item) => String(item.id) === serverId);

  const localError = checked && !LOCAL_PART.test(local.trim()) ? t('create.localError') : undefined;
  const applicantError =
    checked && (bot || writing) && !applicant ? t('create.needApplicant') : undefined;

  const submit = () => {
    setChecked(true);
    if (!server || !LOCAL_PART.test(local.trim()) || ((bot || writing) && !applicant)) return;
    const quotaMb = quotaOf(quota);
    create.mutate(
      {
        server: server.id,
        local_part: local.trim().toLowerCase(),
        applicant: applicant?.id ?? null,
        ...(quotaMb === undefined ? {} : { quota_mb: quotaMb }),
        use_for_bot: bot,
        use_for_writing: writing,
      },
      {
        onSuccess: (mailbox) => {
          toast.success(t('create.done', { address: mailbox.address }));
          setMade({ address: mailbox.address, password: mailbox.password });
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409 ? t('create.taken') : failure(error),
          ),
      },
    );
  };

  if (made)
    return (
      <Dialog
        open
        onClose={onClose}
        title={t('password.title', { address: made.address })}
        closeLabel={t('close')}
        footer={<Button onClick={onClose}>{t('close')}</Button>}
      >
        <PasswordReveal password={made.password} />
      </Dialog>
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('create.title')}
      closeLabel={t('close')}
      footer={
        <>
          <Button disabled={create.isPending || !server} onClick={submit}>
            {t('create.submit')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      {active.length > 1 && (
        <SelectField
          label={t('create.server')}
          value={serverId}
          onChange={setServerId}
          options={active.map((item) => ({ value: String(item.id), label: item.name }))}
        />
      )}
      <TextField
        label={t('create.local')}
        hint={t('create.localHint')}
        error={localError}
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        value={local}
        onChange={(event) => setLocal(event.target.value)}
      />
      {server && (
        <p className="m-0 -mt-2 text-sm text-text-2">
          {t('create.address')}{' '}
          <bdi dir="ltr" className="font-medium text-text">
            {`${local.trim().toLowerCase() || '…'}@${server.domain}`}
          </bdi>
        </p>
      )}
      <ApplicantPicker value={applicant} onChange={setApplicant} error={applicantError} />
      <QuotaField value={quota} onChange={setQuota} defaultMb={server?.default_quota_mb ?? 1024} />
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
    </Dialog>
  );
}
