import { useEffect, useRef, type ReactNode } from 'react';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

/**
 * Title of the current step. Focus moves to it when the step changes (unless a field takes focus),
 * so screen-reader users hear where they are, like a page change.
 */
export function StepHeader({ title, children }: { title: string; children?: ReactNode }) {
  useDocumentTitle(title);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body)
      heading.current?.focus();
  }, [title]);

  return (
    <div className="flex flex-col gap-2">
      <h1
        ref={heading}
        tabIndex={-1}
        className="m-0 font-display text-2xl leading-snug font-bold outline-none"
      >
        {title}
      </h1>
      {children && <p className="m-0 text-[15px] leading-7 text-text-2">{children}</p>}
    </div>
  );
}
