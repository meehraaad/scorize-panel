import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/SectionCard';

export interface ThreadLink {
  key: string;
  label: string;
  /** The thread's address; or `onSelect` where threads switch in place (a chat window). */
  to?: string | undefined;
  onSelect?: (() => void) | undefined;
  active: boolean;
  /** Unread count, already formatted (hide it on the active item). */
  badge?: string | undefined;
}

/** A link to the thread's address, or a button that switches in place (`onSelect`). */
function ThreadItem({ item, className }: { item: ThreadLink; className: string }) {
  const content = (
    <>
      {item.label}
      {item.badge && <Badge>{item.badge}</Badge>}
    </>
  );
  if (item.onSelect || item.to === undefined)
    return (
      <button
        type="button"
        onClick={item.onSelect}
        aria-pressed={item.active}
        className={className}
      >
        {content}
      </button>
    );
  return (
    <Link to={item.to} aria-current={item.active ? 'page' : undefined} className={className}>
      {content}
    </Link>
  );
}

/**
 * Switch between departments (supervisor / writing): a segmented row of links, the active one
 * filled. Links, not buttons: each conversation has its own address.
 */
export function ThreadSwitch({ label, items }: { label: string; items: readonly ThreadLink[] }) {
  return (
    <nav
      aria-label={label}
      className="flex w-full gap-1 rounded-full bg-surface p-1 shadow-panel sm:w-auto"
    >
      {items.map((item) => (
        <ThreadItem
          key={item.key}
          item={item}
          className={`inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-[18px] text-sm font-semibold whitespace-nowrap ${
            item.active ? 'bg-primary text-on-primary' : 'text-text-2 hover:text-text'
          }`}
        />
      ))}
    </nav>
  );
}

/** Sub-tabs inside a department (writing: SOP, CV, …): outlined pills, the active one tinted. */
export function ThreadTabs({
  label,
  lead,
  items,
  compact = false,
}: {
  label: string;
  /** In a narrow box (a chat window): the phone padding at every size. */
  compact?: boolean;
  /** Text before the pills ("Writing department"). */
  lead?: ReactNode;
  items: readonly ThreadLink[];
}) {
  return (
    <nav
      aria-label={label}
      className={`flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-3.5 py-2.5 shadow-[inset_0_-1px_0_var(--hair)] ${compact ? 'flex-none' : 'lg:flex-wrap lg:px-7 lg:py-3.5'}`}
    >
      {lead && <span className="me-1 flex-none text-[13px] text-text-2">{lead}</span>}
      {items.map((item) => (
        <ThreadItem
          key={item.key}
          item={item}
          className={`inline-flex h-11 flex-none items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${
            item.active
              ? 'bg-tint text-primary-text shadow-[inset_0_0_0_1.5px_var(--primary)]'
              : 'text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-text'
          }`}
        />
      ))}
    </nav>
  );
}
