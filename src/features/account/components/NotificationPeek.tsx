import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { notificationsQuery } from '@/lib/account/api';
import { useMarkRead } from '@/lib/account/mutations';
import { NotificationRow } from './NotificationsCard';

/**
 * The newest notifications for the bell's popup (the same first page as the account page), with
 * "read all" while any is unread. Opening one marks it read.
 */
export function NotificationPeek({ limit = 5 }: { limit?: number }) {
  const { t } = useTranslation('account');
  const { data, isPending, isError } = useInfiniteQuery(notificationsQuery);
  const markRead = useMarkRead();
  if (isPending) return <SkeletonRows rows={3} />;
  if (isError) return <Notice tone="error">{t('notifications.error')}</Notice>;
  const first = data.pages[0];
  const items = first?.results.slice(0, limit) ?? [];
  if (items.length === 0)
    return (
      <EmptyState title={t('notifications.emptyTitle')} icon="bell">
        {t('notifications.empty')}
      </EmptyState>
    );
  return (
    <>
      {(first?.unread ?? 0) > 0 && (
        <div className="flex justify-end px-4 pb-1">
          <button
            type="button"
            disabled={markRead.isPending}
            onClick={() => markRead.mutate(undefined)}
            className="min-h-9 rounded-full px-2 text-xs font-bold text-primary-text hover:bg-canvas disabled:opacity-50"
          >
            {t('notifications.readAll')}
          </button>
        </div>
      )}
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <NotificationRow
            key={item.id}
            item={item}
            compact
            onOpen={() => !item.read && markRead.mutate([item.id])}
          />
        ))}
      </ul>
    </>
  );
}
