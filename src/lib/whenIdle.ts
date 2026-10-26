/**
 * Runs `run` once the browser is idle (at the latest after 4 s; 2 s where idle callbacks don't
 * exist). Returns a cancel function, so it fits a `useEffect`.
 */
export function whenIdle(run: () => void) {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(run, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(run, 2000);
  return () => clearTimeout(id);
}
