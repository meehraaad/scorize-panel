import type { ReactNode } from 'react';
import { Link } from 'react-router';

const TILE =
  'flex flex-col gap-2 rounded-[22px] bg-surface p-5 text-text shadow-panel transition-shadow hover:shadow-[var(--panel-shadow),inset_0_0_0_1px_var(--line-2)]';

/**
 * A card that is one link: a title, a line about it, and optionally something at the title's end
 * (a lock) and under it ("See the preview"). `to` stays in the panel; `href` leaves for the site.
 */
export function LinkTile({
  to,
  href,
  title,
  text,
  end,
  footer,
}: {
  to?: string;
  href?: string;
  title: string;
  text: string;
  end?: ReactNode;
  footer?: string;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="text-base font-bold">{title}</span>
        {end}
      </span>
      <span className="text-[13px] leading-6 text-text-2">{text}</span>
      {footer && <span className="mt-1 text-[13px] font-semibold text-primary-text">{footer}</span>}
    </>
  );
  return to === undefined ? (
    <a href={href} className={TILE}>
      {body}
    </a>
  ) : (
    <Link to={to} className={TILE}>
      {body}
    </Link>
  );
}

/** Tiles in a row that wraps: four across on wide screens, two on tablets, one on phones. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
