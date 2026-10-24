import { useState, type ReactNode, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import {
  useChangePassword,
  useResendEmail,
  useUpdateAccount,
  type AccountData,
} from '@/lib/account/api';
import { formatPhone } from '@/lib/site';
import { toast } from '@/lib/toast';

const MIN_PASSWORD = 8;

/** Name, username, phone, email and password, with what can be changed here. */
export function LoginCard({ account }: { account: AccountData }) {
  const { t } = useTranslation('account');
  const [editing, setEditing] = useState<'name' | 'password' | null>(null);
  const resend = useResendEmail();
  const name = [account.first_name, account.last_name].filter(Boolean).join(' ');

  const done = (message: 'nameSaved' | 'passwordSaved') => {
    setEditing(null);
    toast.success(t(`login.${message}`));
  };

  return (
    <SectionCard variant="panel" id="account-login" title={t('login.title')}>
      <div className="flex flex-col">
        <Row
          label={t('login.name')}
          value={name || '—'}
          action={
            editing !== 'name' && (
              <Button
                variant="outline"
                aria-label={t('login.editLabel', { field: t('login.name') })}
                onClick={() => setEditing('name')}
              >
                {t('login.edit')}
              </Button>
            )
          }
        >
          {editing === 'name' && (
            <NameForm
              account={account}
              onDone={() => done('nameSaved')}
              onCancel={() => setEditing(null)}
            />
          )}
        </Row>
        {account.username && <Row label={t('login.username')} value={account.username} ltr />}
        {account.phone && (
          <Row
            label={t('login.phone')}
            value={formatPhone(account.phone)}
            ltr
            note={
              account.phone_verified ? { text: t('login.verified'), tone: 'text-good' } : undefined
            }
          />
        )}
        {account.email && (
          <Row
            label={t('login.email')}
            value={account.email}
            ltr
            note={
              account.email_verified
                ? { text: t('login.verified'), tone: 'text-good' }
                : { text: t('login.unverified'), tone: 'text-warn' }
            }
            action={
              !account.email_verified && (
                <Button
                  variant="primary"
                  disabled={resend.isPending || resend.isSuccess}
                  onClick={() =>
                    resend.mutate(undefined, {
                      onSuccess: () => toast.success(t('login.resent')),
                      onError: () => toast.error(t('login.resendError')),
                    })
                  }
                >
                  {t('login.resend')}
                </Button>
              )
            }
          />
        )}
        <Row
          label={t('login.password')}
          value="••••••••"
          ltr
          action={
            editing !== 'password' && (
              <Button variant="outline" onClick={() => setEditing('password')}>
                {t('login.changePassword')}
              </Button>
            )
          }
        >
          {editing === 'password' && (
            <PasswordForm onDone={() => done('passwordSaved')} onCancel={() => setEditing(null)} />
          )}
        </Row>
      </div>
      <p className="m-0 text-[13px] leading-6 text-text-2">{t('login.changeElsewhere')}</p>
    </SectionCard>
  );
}

function Row({
  label,
  value,
  ltr = false,
  note,
  action,
  children,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  note?: { text: string; tone: string } | undefined;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-3 [&+&]:shadow-[inset_0_1px_0_var(--hair)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] text-text-2">{label}</span>
          <span
            dir={ltr ? 'ltr' : undefined}
            className="text-[15px] font-medium break-all rtl:text-end"
          >
            {value}
          </span>
          {note && <span className={`text-[13px] ${note.tone}`}>{note.text}</span>}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function NameForm({
  account,
  onDone,
  onCancel,
}: {
  account: AccountData;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('account');
  const update = useUpdateAccount();
  const [first, setFirst] = useState(account.first_name);
  const [last, setLast] = useState(account.last_name);
  const [missing, setMissing] = useState(false);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!first.trim() || !last.trim()) {
      setMissing(true);
      return;
    }
    update.mutate(
      { first_name: first.trim(), last_name: last.trim() },
      { onError: () => toast.error(t('login.error')), onSuccess: onDone },
    );
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t('login.firstName')}
          autoComplete="given-name"
          value={first}
          error={missing && !first.trim() ? t('login.required') : undefined}
          onChange={(event) => setFirst(event.target.value)}
        />
        <TextField
          label={t('login.lastName')}
          autoComplete="family-name"
          value={last}
          error={missing && !last.trim() ? t('login.required') : undefined}
          onChange={(event) => setLast(event.target.value)}
        />
      </div>
      <FormButtons pending={update.isPending} onCancel={onCancel} />
    </form>
  );
}

function PasswordForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation('account');
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [problem, setProblem] = useState<'required' | 'short' | null>(null);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!current || !next) {
      setProblem('required');
      return;
    }
    if (next.length < MIN_PASSWORD) {
      setProblem('short');
      return;
    }
    setProblem(null);
    change.mutate({ current, new: next }, { onSuccess: onDone });
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      <TextField
        label={t('login.current')}
        type="password"
        autoComplete="current-password"
        value={current}
        error={problem === 'required' && !current ? t('login.required') : undefined}
        onChange={(event) => setCurrent(event.target.value)}
      />
      <TextField
        label={t('login.newPassword')}
        type="password"
        autoComplete="new-password"
        hint={t('login.newHint')}
        value={next}
        error={
          problem === 'short'
            ? t('login.short')
            : problem === 'required' && !next
              ? t('login.required')
              : undefined
        }
        onChange={(event) => setNext(event.target.value)}
      />
      {change.isError && <Notice tone="error">{t('login.wrongPassword')}</Notice>}
      <FormButtons pending={change.isPending} onCancel={onCancel} />
    </form>
  );
}

function FormButtons({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  const { t } = useTranslation('account');
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={pending} onClick={onCancel}>
        {t('login.cancel')}
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? t('login.saving') : t('login.save')}
      </Button>
    </div>
  );
}
