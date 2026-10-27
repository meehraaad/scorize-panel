import type { ReactNode } from 'react';
import { Card } from './Card';

interface SectionCardProps {
  /** Id of the heading; the card is a region named by it. */
  id: string;
  title: ReactNode;
  /** A line under the title. */
  subtitle?: ReactNode;
  /** Next to the title: a count badge, a status chip. */
  badge?: ReactNode;
  /** At the end of the title row: a link, a count, a progress bar. */
  end?: ReactNode;
  /**
   * `list`: the header is padded, the body runs edge to edge (rows with dividers, forms with their
   * own padding). `panel`: one padded column with a smaller title (side cards, summaries).
   */
  variant?: 'list' | 'panel';
  /** Title size: `lg` for main cards, `md` for small side cards. Defaults: list → lg, panel → md. */
  size?: 'lg' | 'md';
  className?: string;
  children?: ReactNode;
}

/**
 * A titled card: the building block of every page. The heading is an h2 tied to the card
 * (`aria-labelledby`), so screen readers list each card as a region by its title.
 */
export function SectionCard({
  id,
  title,
  subtitle,
  badge,
  end,
  variant = 'list',
  size,
  className = '',
  children,
}: SectionCardProps) {
  const panel = variant === 'panel';
  const large = (size ?? (panel ? 'md' : 'lg')) === 'lg';
  return (
    <Card
      aria-labelledby={id}
      className={`${panel ? 'flex flex-col gap-4 p-5 lg:p-7' : ''} ${className}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${
          panel ? '' : 'px-5 pt-5 pb-2 lg:px-8 lg:pt-7 lg:pb-3'
        }`}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 id={id} className={`m-0 font-bold ${large ? 'font-display text-xl' : 'text-base'}`}>
              {title}
            </h2>
            {badge}
          </div>
          {subtitle && <span className="text-sm leading-7 text-text-2">{subtitle}</span>}
        </div>
        {end}
      </div>
      {children}
    </Card>
  );
}

/**
 * The title of a page section that isn't a single card (a list with its own toolbar, several
 * cards under one heading). Larger than a card title.
 */
export function SectionHeading({
  id,
  title,
  subtitle,
  end,
}: {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="m-0 font-display text-[22px] font-bold">
          {title}
        </h2>
        {subtitle && <p className="m-0 text-sm leading-7 text-text-2">{subtitle}</p>}
      </div>
      {end}
    </div>
  );
}

/**
 * A page section without a card: a thin line above, the heading on the start side and the content
 * beside it (under it on phones). For calm pages where only the main block is raised.
 */
export function SideSection({
  id,
  title,
  subtitle,
  end,
  className = '',
  children,
}: {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Under the heading: a link, a "show more". */
  end?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`grid gap-x-14 gap-y-4 pt-7 shadow-[inset_0_1px_0_var(--line-2)] lg:grid-cols-[minmax(200px,280px)_minmax(0,1fr)] lg:pt-8 ${className}`}
    >
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="m-0 font-display text-[22px] leading-relaxed font-bold">
          {title}
        </h2>
        {subtitle && <p className="m-0 text-sm leading-7 text-text-2">{subtitle}</p>}
        {end}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Small count next to a title ("2 new"). */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold whitespace-nowrap text-on-primary">
      {children}
    </span>
  );
}
