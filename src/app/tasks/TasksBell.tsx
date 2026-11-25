import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { unreadQuery } from '@/lib/account/api';
import { isActiveStaff } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { taskPanelOf } from '@/lib/tasks/api';
import { useOpenTasks } from '@/lib/tasks/useOpenTasks';
import { useDismiss } from '@/lib/useDismiss';
import { inboxHref } from './inbox';

const BellPopover = lazy(() => import('./BellPopover'));

/** Past this the badge reads "99+". */
const MOST = 99;

const bellClass =
  'relative inline-flex size-11 items-center justify-center rounded-full text-text-2 transition-colors hover:bg-canvas hover:text-text aria-expanded:bg-tint aria-expanded:text-primary-text';

/**
 * The header's bell: how much waits for me (unread notifications, and for staff the tasks waiting:
 * my follow-ups due by today and colleagues' requests) as one count. Staff open a popup with both
 * on a desktop and the page (`/tasks`) on a phone; everyone else goes to their notifications.
 * `panel`: the panel the user is in, whose tasks it counts (its own context, else `staff`).
 */
export function TasksBell({ user, panel }: { user: SessionUser; panel: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const staff = isActiveStaff(user);
  const tasksPanel = taskPanelOf(user, panel);
  const { data: unread = 0 } = useQuery(unreadQuery);
  const { count } = useOpenTasks(tasksPanel, staff);
  const waiting = unread + (staff ? count : 0);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popupId = useId();
  useDismiss(open, root, (how) => {
    setOpen(false);
    if (how === 'escape') button.current?.focus();
  });

  const label = staff
    ? waiting
      ? t('header.tasksWaiting', { n: f.number(waiting) })
      : t('header.tasks')
    : unread
      ? t('header.notificationsUnread', { n: f.number(unread) })
      : t('header.notifications');
  const face = (
    <>
      <Icon name="bell" size={18} />
      {waiting > 0 && (
        <span
          aria-hidden="true"
          className="absolute end-1 top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-none font-bold text-on-primary tabular-nums shadow-[0_0_0_2px_var(--surface)]"
        >
          {waiting > MOST ? `${f.number(MOST)}+` : f.number(waiting)}
        </span>
      )}
    </>
  );

  if (!staff)
    return (
      <Link to="/account#notifications" aria-label={label} className={bellClass}>
        {face}
      </Link>
    );

  return (
    <div ref={root} className="relative">
      {/* Phones: the whole page; a popup has no room under a narrow header. */}
      <Link
        to={inboxHref('tasks', tasksPanel)}
        aria-label={label}
        className={`${bellClass} lg:hidden`}
      >
        {face}
      </Link>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={popupId}
        onClick={() => setOpen((value) => !value)}
        className={`${bellClass} max-lg:hidden`}
      >
        {face}
      </button>
      {open && (
        <section
          id={popupId}
          aria-label={t('header.tasks')}
          className="absolute end-0 top-full z-40 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card bg-surface text-text shadow-float max-lg:hidden"
        >
          <Suspense fallback={<SkeletonRows rows={4} />}>
            <BellPopover panel={tasksPanel} />
          </Suspense>
        </section>
      )}
    </div>
  );
}
