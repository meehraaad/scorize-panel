import type { ReactNode } from 'react';

/**
 * The rows of a `list` `SectionCard`: one item per line with a hairline between, at the card's side
 * padding, so every list card lines up with its title. `Row` holds what a line shows; it wraps on
 * phones.
 */
export function RowList({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col p-0 pb-3">
      {children}
    </ul>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-hair px-5 py-3 first:border-t-0 lg:px-8">
      {children}
    </li>
  );
}
