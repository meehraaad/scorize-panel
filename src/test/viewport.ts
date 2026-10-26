import { onTestFinished, vi } from 'vitest';
import { DESKTOP_QUERY } from '@/lib/useMediaQuery';

/** Tests run at phone width (src/test/setup.ts); this test runs at desktop width instead. */
export function onDesktop() {
  const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === DESKTOP_QUERY,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
  onTestFinished(() => {
    spy.mockRestore();
  });
}
