import type { ReactNode } from 'react';

/**
 * The save row of a long form, kept in view at the bottom while scrolling: what is unsaved, then
 * the actions (undo, save). `dirty` lights it up so unsaved changes are hard to miss.
 */
export function SaveBar({
  message,
  dirty,
  children,
}: {
  message: ReactNode;
  dirty: boolean;
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-[calc(var(--panel-bottom,0px)+0.75rem)] z-30">
      <div
        className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 shadow-panel ${
          dirty ? 'bg-hero text-on-hero' : 'bg-surface text-text-2'
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
          {dirty && (
            <span aria-hidden="true" className="size-2 flex-none rounded-full bg-hero-current" />
          )}
          {message}
        </span>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}
