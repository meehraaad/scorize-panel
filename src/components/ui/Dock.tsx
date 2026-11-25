import type { ReactNode } from 'react';

/**
 * A pill of icon-only quick actions (the customer page's WhatsApp, Telegram, tablet link, visit):
 * `IconButton`s and `IconLink`s inside, with `tip` labels, split into groups by `DockDivider`.
 */
export function Dock({
  label,
  className = '',
  children,
}: {
  /** Names the group for screen readers. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex h-12 items-center gap-0.5 rounded-full bg-dock px-0.5 shadow-dock ${className}`}
    >
      {children}
    </div>
  );
}

/** A thin line between two groups of a dock. */
export function DockDivider() {
  return <span aria-hidden="true" className="mx-1 h-5.5 w-px flex-none bg-line-2" />;
}
