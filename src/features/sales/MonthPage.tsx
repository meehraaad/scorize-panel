import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PasswordGate } from '@/components/ui/PasswordGate';
import { ApiError } from '@/lib/api/client';
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
      id="month-lock"
      title={t('month.lock.title')}
      subtitle={t('month.lock.subtitle')}
      submit={t('month.lock.submit')}
      pending={unlock.isPending}
      error={unlock.error}
      onSubmit={(password) => open(password)}
    />
  );
}
