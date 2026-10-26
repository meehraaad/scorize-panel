import { useEffect, useState } from 'react';

/** Wait before searching: one request once typing pauses, not one per letter. */
export const SEARCH_DELAY_MS = 300;

/** `value`, updated only after it has stayed the same for `delay` ms. */
export function useDebouncedValue<T>(value: T, delay = SEARCH_DELAY_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
