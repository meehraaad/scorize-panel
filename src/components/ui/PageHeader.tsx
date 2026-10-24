import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Phones: no subtitle and tighter spacing, to leave the screen to the page (a chat). */
  compact?: boolean;
}

export function PageHeader({ title, subtitle, actions, compact = false }: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <div
      className={`flex flex-wrap items-end justify-between lg:py-4 ${
        compact ? 'gap-3 py-0' : 'gap-4 py-2'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-2.5">
        <h1 className="m-0 font-display text-2xl leading-snug font-bold lg:text-[32px]">{title}</h1>
        {subtitle && (
          <p
            className={`m-0 text-base leading-8 text-text-2 lg:text-lg ${
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
