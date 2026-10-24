import type { ReactNode } from 'react';
import { Card } from './Card';

/**
 * "Nothing here yet": a sentence and an optional next step.
 * - `inset`: inside a card, under its title (same side padding as the card's rows)
 * - `padded`: the whole body of a card that has no title
 * - `card`: a card of its own
 */
export function EmptyState({
  children,
  action,
  variant = 'inset',
}: {
  children: ReactNode;
  action?: ReactNode;
  variant?: 'inset' | 'padded' | 'card';
}) {
  const body = (
    <>
      <p className="m-0 text-[15px] leading-7 text-text-2">{children}</p>
      {action}
    </>
  );
  if (variant === 'card')
    return <Card className="flex flex-col items-start gap-4 p-6 lg:p-8">{body}</Card>;
  if (variant === 'padded')
    return <div className="flex flex-col items-start gap-4 p-6 lg:p-8">{body}</div>;
  return (
    <div className="flex flex-col items-start gap-4 px-5 pt-2 pb-6 lg:px-8 lg:pb-8">{body}</div>
  );
}
