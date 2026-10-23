import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export function startMocks() {
  return setupWorker(...handlers).start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledFrame: 'bypass',
    quiet: true,
  });
}
