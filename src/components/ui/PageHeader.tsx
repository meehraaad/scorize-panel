import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 py-2 lg:py-4">
      <div className="flex min-w-0 flex-col gap-2.5">
        <h1 className="m-0 font-display text-2xl leading-snug font-bold lg:text-[32px]">{title}</h1>
        {subtitle && <p className="m-0 text-base leading-8 text-text-2 lg:text-lg">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
