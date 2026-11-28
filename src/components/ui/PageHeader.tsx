import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

// A Persian title with a Latin run in it (a name, «سلام Admin، ۱۷ کار …»): the Latin word, the comma and the digits
// after it would form one left-to-right run, so the name and the number swap places. Each Latin run is isolated
// (<bdi>), which leaves the text (accessible name, tab title) unchanged.
const PERSIAN = /[\u0600-\u06FF]/;
const LATIN_RUN = /([A-Za-z][\w.'-]*(?:\s+[A-Za-z][\w.'-]*)*)/;

function isolateLatin(title: string): ReactNode {
  if (!PERSIAN.test(title)) return title;
  return title
    .split(LATIN_RUN)
    .map((part, index) => (index % 2 === 1 ? <bdi key={index}>{part}</bdi> : part));
}

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Phones: no subtitle and tighter spacing, to leave the screen to the page (a chat). */
  compact?: boolean;
  /** Dense toolbar heading for viewport-height workspaces. */
  size?: 'page' | 'workspace';
}

export function PageHeader({
  title,
  subtitle,
  actions,
  compact = false,
  size = 'page',
}: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <div
      className={`flex flex-wrap justify-between ${size === 'workspace' ? 'items-center' : 'items-end lg:py-4'} ${
        compact || size === 'workspace' ? 'gap-3 py-0' : 'gap-4 py-2'
      }`}
    >
      <div className={`flex min-w-0 flex-col ${size === 'workspace' ? 'gap-1' : 'gap-2.5'}`}>
        <h1
          className={`m-0 leading-snug font-bold ${size === 'workspace' ? 'text-xl tracking-tight' : 'font-display text-xl lg:text-[32px]'}`}
        >
          {isolateLatin(title)}
        </h1>
        {subtitle && (
          <p
            className={`m-0 text-text-2 ${size === 'workspace' ? 'text-[13px] leading-6' : 'text-sm leading-7 lg:text-lg'} ${
              compact ? 'max-lg:hidden' : ''
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
