import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge, SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Notice } from '@/components/ui/Notice';
import { notificationsQuery, useMarkRead, type Notification } from '@/lib/account/api';
import { useFormat } from '@/lib/i18n/useFormat';

const PANEL_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Recent notifications, newest first; older ones on demand. Opening one marks it read. */
export function NotificationsCard() {
  const { t } = useTranslation('account');
  const f = useFormat();
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(notificationsQuery);
  const markRead = useMarkRead();
  const items = data?.pages.flatMap((page) => page.results) ?? [];
  const unread = data?.pages[0]?.unread ?? 0;

  return (
    <SectionCard
      id="notifications"
      title={t('notifications.title')}
      className="scroll-mt-28"
      badge={unread > 0 && <Badge>{t('notifications.new', { n: f.number(unread) })}</Badge>}
      end={
        unread > 0 && (
          <Button
            variant="outline"
            disabled={markRead.isPending}
            onClick={() => markRead.mutate(undefined)}
          >
            {t('notifications.readAll')}
          </Button>
        )
      }
    >
      {isPending ? (
        <div className="px-5 pb-6 lg:px-8">
          <SkeletonRows rows={4} />
        </div>
      ) : isError ? (
        <div className="px-5 pb-6 lg:px-8">
          <Notice tone="error">{t('notifications.error')}</Notice>
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t('notifications.emptyTitle')} icon="bell">
          {t('notifications.empty')}
        </EmptyState>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <Item
              key={item.id}
              item={item}
              onOpen={() => !item.read && markRead.mutate([item.id])}
            />
          ))}
        </ul>
      )}
      {hasNextPage && (
        <div className="px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
          <Button
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? t('notifications.loading') : t('notifications.older')}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

function Item({ item, onOpen }: { item: Notification; onOpen: () => void }) {
  const { t } = useTranslation('account');
  const f = useFormat();
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`mt-2 size-2 flex-none rounded-full ${item.read ? '' : 'bg-primary'}`}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className={`text-[15px] ${item.read ? 'font-medium' : 'font-bold'}`}>
            {!item.read && <span className="sr-only">{`${t('notifications.unread')}: `}</span>}
            {item.title}
          </span>
          <time dateTime={item.created_at} className="text-[13px] text-text-2">
            {f.timeAgo(item.created_at)}
          </time>
        </span>
        <span className="text-sm leading-7 text-text-2">{item.text}</span>
      </span>
    </>
  );
  const row = `flex gap-3 px-5 py-4 text-text shadow-[inset_0_1px_0_var(--hair)] lg:px-8 ${
    item.read ? '' : 'bg-row-highlight'
  }`;
  // Links inside the panel stay in the app; others (the main site) load normally.
  const inPanel = item.url?.startsWith(`${PANEL_BASE}/`);
  return (
    <li>
      {item.url === null ? (
        <div className={row}>{body}</div>
      ) : inPanel ? (
        <Link
          to={item.url.slice(PANEL_BASE.length)}
          onClick={onOpen}
          className={`${row} hover:bg-canvas`}
        >
          {body}
        </Link>
      ) : (
        <a href={item.url} onClick={onOpen} className={`${row} hover:bg-canvas`}>
          {body}
        </a>
      )}
    </li>
  );
}
