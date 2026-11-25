import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { NewTaskButton } from '@/components/tasks/NewTask';
import { InTray } from '@/components/ui/DockTray';
import { Icon } from '@/components/ui/Icon';
import { TaskPeek } from '@/features/tasks/components/TaskPeek';
import type { SessionUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { taskPanelOf, tasksQuery } from '@/lib/tasks/api';
import { useOpenTasks } from '@/lib/tasks/useOpenTasks';
import { useDismiss } from '@/lib/useDismiss';
import { TASK_CONTEXTS } from '@/panels/taskContexts';
import { inboxHref } from './inbox';

/** A panel's tasks page or the shared one: the dock would only repeat it. */
const TASKS_PAGE = /(^|\/)tasks\/?$/;

/**
 * Today's tasks, always at hand: an ink pill in the bottom tray (how many wait, how many are late,
 * the next one's hour) that opens a small window above it with the list, done from its tick, and a
 * new task. It lines up with a seller's minimized logs and calls (DockTray); open windows such as
 * a log take the other corner, so the two never cover each other.
 */
export default function TasksDock({ user, panel }: { user: SessionUser; panel: string }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const tasksPanel = taskPanelOf(user, panel);
  const { mine, requests, count } = useOpenTasks(tasksPanel);
  const [open, setOpen] = useState(false);
  const overview = useQuery({ ...tasksQuery(tasksPanel), enabled: open });
  const pill = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLElement>(null);
  const titleId = useId();
  const { pathname } = useLocation();
  useDismiss(open, [pill, popup], (how) => {
    setOpen(false);
    if (how === 'escape') pill.current?.focus();
  });

  if (TASKS_PAGE.test(pathname) || !mine.data || !requests.data) return null;

  // "Now" is when the lists were read: they refresh on focus, and the counts follow them.
  const now = Math.max(mine.dataUpdatedAt, requests.dataUpdatedAt);
  const waiting = [...mine.data.results, ...requests.data.results];
  const late = waiting.filter((task) => new Date(task.due_at).getTime() < now).length;
  const next = waiting
    .filter((task) => task.timed !== false && new Date(task.due_at).getTime() >= now)
    .sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
  const status =
    late > 0
      ? t('dock.late', { n: f.number(late) })
      : next
        ? t('dock.next', { time: f.time(next.due_at) })
        : t('dock.clear');
  const done = overview.data?.done_today ?? 0;

  return (
    <>
      <InTray>
        <button
          ref={pill}
          type="button"
          aria-expanded={open}
          aria-controls={open ? titleId : undefined}
          aria-label={t('dock.label', { open: f.number(count), late: f.number(late) })}
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex h-12 max-w-full items-center gap-2.5 rounded-full bg-hero ps-2 pe-4 text-on-hero shadow-float transition-shadow [body:has([data-workspace-fullscreen])_&]:hidden ${
            open ? 'ring-3 ring-hero-accent' : ''
          }`}
        >
          <span
            className={`inline-flex size-8 flex-none items-center justify-center rounded-full bg-hero-raised text-[13px] font-extrabold tabular-nums ring-2 ring-inset ${
              late > 0 ? 'ring-hero-current' : 'ring-live'
            }`}
          >
            {f.number(count)}
          </span>
          <span className="flex min-w-0 flex-col text-start leading-tight">
            <span className="truncate text-[13px] font-bold max-lg:hidden">{t('dock.title')}</span>
            <span
              className={`truncate text-xs font-semibold max-lg:text-[13px] ${
                late > 0 ? 'text-hero-current' : 'text-on-hero-2'
              }`}
            >
              {status}
            </span>
          </span>
        </button>
      </InTray>

      {open && (
        <section
          ref={popup}
          aria-labelledby={titleId}
          className="fixed inset-x-3 bottom-[calc(148px+env(safe-area-inset-bottom))] z-40 flex max-h-[calc(100dvh-240px)] flex-col overflow-hidden rounded-card bg-surface text-text shadow-float lg:inset-x-auto lg:start-5 lg:bottom-[80px] lg:max-h-[calc(100dvh-180px)] lg:w-[420px]"
        >
          <header className="flex flex-col gap-3 bg-hero px-5 pt-4 pb-4 text-on-hero">
            <div className="flex items-center justify-between gap-3">
              <h2 id={titleId} className="m-0 font-display text-base font-bold">
                {t('dock.title')}
              </h2>
              <div className="flex">
                <Link
                  to={inboxHref('tasks', tasksPanel)}
                  aria-label={t('dock.page')}
                  title={t('dock.page')}
                  className="inline-flex size-11 items-center justify-center rounded-full hover:bg-hero-raised"
                >
                  <Icon name="expand" size={17} />
                </Link>
                <button
                  type="button"
                  aria-label={t('dock.minimize')}
                  title={t('dock.minimize')}
                  onClick={() => setOpen(false)}
                  className="inline-flex size-11 items-center justify-center rounded-full hover:bg-hero-raised"
                >
                  <Icon name="collapse" size={17} />
                </button>
              </div>
            </div>
            {/* The day as one bar: done, still open, late. */}
            <div aria-hidden="true" className="flex h-1.5 gap-0.5">
              {done > 0 && <span className="rounded-full bg-live" style={{ flexGrow: done }} />}
              {count - late > 0 && (
                <span className="rounded-full bg-hero-line" style={{ flexGrow: count - late }} />
              )}
              {late > 0 && (
                <span className="rounded-full bg-hero-current" style={{ flexGrow: late }} />
              )}
            </div>
            <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-hero-2">
              <span>{t('dock.done', { n: f.number(done) })}</span>
              <span>{t('dock.open', { n: f.number(count) })}</span>
              {late > 0 && (
                <span className="text-hero-current">{t('dock.late', { n: f.number(late) })}</span>
              )}
            </p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
            <TaskPeek config={TASK_CONTEXTS[tasksPanel]} limit={6} />
          </div>
          {overview.data && (
            <footer className="flex justify-end px-4 py-3 shadow-[inset_0_1px_0_var(--hair)]">
              <NewTaskButton colleagues={overview.data.colleagues} />
            </footer>
          )}
        </section>
      )}
    </>
  );
}
