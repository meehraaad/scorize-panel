import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { handlers, resetMockSession } from '@/mocks/handlers';

/** Fake Django (src/mocks) for integration tests. Import once per test file. */
export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  // Node's fetch rejects relative URLs; the app uses same-origin paths like a browser would.
  const intercepted = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    intercepted(
      typeof input === 'string' && input.startsWith('/')
        ? new URL(input, window.location.origin).href
        : input,
      init,
    );
});
afterEach(() => {
  server.resetHandlers();
  resetMockSession();
});
afterAll(() => {
  server.close();
});
