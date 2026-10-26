import { Suspense, lazy, type ComponentProps } from 'react';
import type { DatePicker } from './DatePicker';

const Picker = lazy(() => import('./DatePicker').then((module) => ({ default: module.DatePicker })));

/**
 * `DatePicker` with its code (calendar math, keyboard handling) fetched on first show: for forms
 * where the date sits behind a choice ("another time…"), so the page's first load doesn't carry
 * it. Holds the field's place while the code arrives.
 */
export function LazyDatePicker(props: ComponentProps<typeof DatePicker>) {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="flex flex-col gap-2">
          <span className="block h-4 w-32 animate-pulse rounded-full bg-track" />
          <span className="block h-11 animate-pulse rounded-full bg-track" />
        </div>
      }
    >
      <Picker {...props} />
    </Suspense>
  );
}
