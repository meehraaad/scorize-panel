import { useEffect, type RefObject } from 'react';

/**
 * Keeps a `fixed bottom-0` bar on the screen's bottom edge. When the browser's toolbar hides on
 * scroll, iOS Safari can leave fixed elements where the toolbar's top was, with an empty band
 * below them. The visual viewport still reports the real bottom, so the bar is moved down by that
 * gap. Never up: a smaller visual viewport is the keyboard or a pinch zoom, left as they are.
 */
export function usePinToScreenBottom(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const bar = ref.current;
    if (!viewport || !bar) return;

    let shift = 0;
    let frame = 0;
    const place = () => {
      frame = 0;
      const box = bar.getBoundingClientRect();
      const zoomed = Math.abs(viewport.scale - 1) > 0.01;
      const gap = viewport.offsetTop + viewport.height - (box.bottom - shift);
      // No box: the bar is hidden (wide screens, a full-screen workspace).
      const next = box.height && !zoomed && gap > 0.5 ? gap : 0;
      if (next === shift) return;
      shift = next;
      bar.style.transform = next ? `translateY(${next}px)` : '';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    place();
    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
      window.removeEventListener('scroll', schedule);
      bar.style.transform = '';
    };
  }, [ref]);
}
