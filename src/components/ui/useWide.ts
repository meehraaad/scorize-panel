import { useLayoutEffect, useState, type RefObject } from 'react';

/** From this container width (px) a calendar shows the whole week; below it, one day at a time. */
export const WEEK_WIDTH = 720;

/**
 * Whether the element is at least `width` px wide (measured before paint, so only one layout is
 * drawn; jsdom and other unknown widths count as wide), following it as it resizes.
 */
export function useWide(ref: RefObject<HTMLElement | null>, width: number) {
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWide(element.clientWidth === 0 || element.clientWidth >= width);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, width]);
  return wide;
}
