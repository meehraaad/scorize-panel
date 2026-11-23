import type { ReactNode } from 'react';

/** Label and value pairs in two columns (a staff file's details); an empty value shows a dash. */
export function Facts({ label, rows }: { label: string; rows: [string, ReactNode][] }) {
  return (
    <dl aria-label={label} className="m-0 grid gap-x-6 gap-y-3 px-5 pb-5 sm:grid-cols-2 lg:px-8">
      {rows.map(([name, value]) => (
        <div key={name} className="flex flex-col gap-0.5">
          <dt className="text-xs text-text-2">{name}</dt>
          <dd className="m-0 text-[15px] font-medium [overflow-wrap:anywhere]">{value || '–'}</dd>
        </div>
      ))}
    </dl>
  );
}
