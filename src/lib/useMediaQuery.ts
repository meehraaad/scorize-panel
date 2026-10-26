import { useSyncExternalStore } from 'react';

/** Tailwind's `lg` and up: side columns beside the page, no bottom tabs. */
export const DESKTOP_QUERY = '(min-width: 1024px)';

/** Whether a media query matches now, re-rendering when it changes (a phone turned sideways). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
