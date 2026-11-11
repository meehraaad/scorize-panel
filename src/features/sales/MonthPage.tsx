import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useUser } from '@/lib/auth/session';
import { toast } from '@/lib/toast';
import { MonthReport } from './components/MonthReport';
import { useMonthUnlock, type MonthData } from './api/month';

/**
 * The seller's month: goal, funnel, first-call speed, which sources convert. Canvas "ماه من".
 * Opens only after the seller types their password, on every visit (nothing is kept in a cache).
 */
export default function MonthPage() {
  const { t } = useTranslation('sales');
  const unlock = useMonthUnlock();
  // Kept in the page's state only (never a cache), so another month opens without asking again.
  const [opened, setOpened] = useState<{ password: string; data: MonthData } | null>(null);
  const open = (password: string, month?: string) => {
    unlock.mutate(
      { password, ...(month ? { month } : {}) },
      {
        onSuccess: (data) => setOpened({ password, data }),
        onError: (error) => {
          if (!(error instanceof ApiError && [400, 409, 429].includes(error.status)))
            toast.error(t('month.lock.failed'));
          else if (opened) toast.error(t('month.lock.failed'));
        },
      },
    );
  };
  return opened ? (
    <MonthReport data={opened.data} onMonth={(month) => open(opened.password, month)} />
  ) : (
    <PasswordGate
      pending={unlock.isPending}
      error={unlock.error}
      onSubmit={(password) => open(password)}
    />
  );
}

/** Asks for the account's password before the month (commission, rank) is shown. */
function PasswordGate({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error: Error | null;
  onSubmit: (password: string) => void;
}) {
  const { t } = useTranslation('sales');
  const user = useUser();
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState(false);
  const status = error instanceof ApiError ? error.status : null;

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    setMissing(!password);
    if (password) onSubmit(password);
  };

  return (
    <PageStack>
      <PageHeader title={t('month.lock.title')} subtitle={t('month.lock.subtitle')} />
      <SectionCard variant="panel" id="month-lock" title={t('month.lock.card')}>
        {status === 409 ? (
          <Notice tone="warn">{t('month.lock.noPassword')}</Notice>
        ) : (
          <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-4">
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
              label={t('month.lock.password')}
              name="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              autoFocus
              value={password}
              error={
                missing
                  ? t('month.lock.required')
                  : status === 400
                    ? t('month.lock.wrong')
                    : status === 429
                      ? t('month.lock.tooMany')
                      : undefined
              }
              onChange={(event) => {
                setPassword(event.target.value);
                setMissing(false);
              }}
            />
            <Button type="submit" disabled={pending} aria-busy={pending} className="self-start">
              {t('month.lock.submit')}
            </Button>
          </form>
        )}
      </SectionCard>
    </PageStack>
  );
}
