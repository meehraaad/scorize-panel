import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

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
          className={`m-0 leading-snug font-bold ${size === 'workspace' ? 'text-xl tracking-tight' : 'font-display text-2xl lg:text-[32px]'}`}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`m-0 text-text-2 ${size === 'workspace' ? 'text-[13px] leading-6' : 'text-base leading-8 lg:text-lg'} ${
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
