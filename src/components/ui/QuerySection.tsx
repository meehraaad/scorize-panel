import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { SkeletonRows } from './Skeleton';

/** Keep ready dashboard sections usable when a sibling is pending or failed. */
export function QuerySection({
  pending,
  error,
  retry,
  children,
}: {
  pending: boolean;
  error: unknown;
  retry: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  if (error)
    return (
      <div role="alert" className="rounded-card bg-surface p-5">
        <p>{t('errors.sectionTitle')}</p>
        <Button variant="outline" onClick={retry}>
          {t('errors.retry')}
        </Button>
      </div>
    );
  if (pending)
    return (
      <div role="status" aria-label={t('status.loading')}>
        <SkeletonRows rows={3} />
      </div>
    );
  return children;
}
