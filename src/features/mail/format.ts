import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';

/** "512 MB", "1.5 GB". */
export function useSize() {
  const { t } = useTranslation('mail');
  const f = useFormat();
  return (mb: number) =>
    mb >= 1024
      ? t('gb', { n: f.number(Math.round((mb / 1024) * 10) / 10) })
      : t('mb', { n: f.number(mb) });
}

/** What a failed change says: the mail server's own answer (502), or the generic line. */
export function useFailure() {
  const { t } = useTranslation('mail');
  return (error: unknown) => {
    if (error instanceof ApiError && error.status === 502) {
      const detail = (error.body as { detail?: unknown } | null)?.detail;
      if (typeof detail === 'string') return t('serverError', { detail });
    }
    return t('saveError');
  };
}

/** The quota select's value as the API takes it (`default`: leave it out). */
export const quotaOf = (value: string) =>
  value === 'none' ? null : value === 'default' ? undefined : Number(value);
