import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api/client';
import { useUser } from '@/lib/auth/session';
import { Button } from './Button';
import { Notice } from './Notice';
import { PageStack } from './PageColumns';
import { PageHeader } from './PageHeader';
import { SectionCard } from './SectionCard';
import { TextField } from './TextField';

/**
 * Asks for the account's password before a page that shows money (a seller's month, a person's
 * pay), on every visit. Django answers 400 for a wrong one, 429 after too many, 409 for an account
 * without a password (`api.core.password_gate`). The page keeps what it opened in its state only.
 */
export function PasswordGate({
  id,
  title,
  subtitle,
  submit,
  pending,
  error,
  onSubmit,
}: {
  id: string;
  title: string;
  subtitle: string;
  submit: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (password: string) => void;
}) {
  const { t } = useTranslation();
  const user = useUser();
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState(false);
  const status = error instanceof ApiError ? error.status : null;

  const send = (event: SubmitEvent) => {
    event.preventDefault();
    setMissing(!password);
    if (password) onSubmit(password);
  };

  return (
    <PageStack>
      <PageHeader title={title} subtitle={subtitle} />
      <SectionCard variant="panel" id={id} title={t('passwordGate.card')}>
        {status === 409 ? (
          <Notice tone="warn">{t('passwordGate.noPassword')}</Notice>
        ) : (
          <form noValidate onSubmit={send} className="flex max-w-md flex-col gap-4">
            {/* Lets password managers fill the right account. */}
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={user.email ?? ''}
              readOnly
              hidden
            />
            <TextField
              label={t('passwordGate.password')}
              name="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              autoFocus
              value={password}
              error={
                missing
                  ? t('passwordGate.required')
                  : status === 400
                    ? t('passwordGate.wrong')
                    : status === 429
                      ? t('passwordGate.tooMany')
                      : undefined
              }
              onChange={(event) => {
                setPassword(event.target.value);
                setMissing(false);
              }}
            />
            <Button type="submit" disabled={pending} aria-busy={pending} className="self-start">
              {submit}
            </Button>
          </form>
        )}
      </SectionCard>
    </PageStack>
  );
}
