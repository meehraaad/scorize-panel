import type { ReactNode } from 'react';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';

/**
 * "Nothing here yet": what will show up here, and a clear next step when there is one
 * (canvas V6 section 14, empty states). With `title`, an icon tile and a bold line come first.
 * - `inset`: inside a card, under its title (same side padding as the card's rows)
 * - `padded`: the whole body of a card that has no title
 * - `card`: a card of its own
 */
export function EmptyState({
  children,
  title,
  icon = 'check',
  action,
  variant = 'inset',
}: {
  children: ReactNode;
  title?: string | undefined;
  icon?: IconName;
  action?: ReactNode;
  variant?: 'inset' | 'padded' | 'card';
}) {
  const body = (
    <>
      {title && (
        <>
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-2xl bg-tint text-primary-text"
          >
            <Icon name={icon} size={22} />
          </span>
          <p className="m-0 -mb-2 text-[17px] font-bold">{title}</p>
        </>
      )}
      <p className="m-0 text-[15px] leading-7 text-text-2">{children}</p>
      {action}
    </>
  );
  if (variant === 'card')
    return <Card className="flex flex-col items-start gap-3 p-6 lg:p-8">{body}</Card>;
  if (variant === 'padded')
    return <div className="flex flex-col items-start gap-3 p-6 lg:p-8">{body}</div>;
  return (
    <div className="flex flex-col items-start gap-3 px-5 pt-2 pb-6 lg:px-8 lg:pb-8">{body}</div>
  );
}
