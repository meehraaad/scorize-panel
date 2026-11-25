// First: the panel's local time is Tehran time on every computer (src/lib/tehranTime.ts).
import '@/lib/tehranTimeInstall';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/lib/i18n';
import '@/styles/index.css';
import { App } from '@/app/App';
import { startCachePersistence } from '@/lib/api/persist';
import { ON_SERVER } from '@/lib/applicant/onServer';

// Answers this tab had before a reload (restored once the session names the same user).
startCachePersistence();
if (ON_SERVER.siteHealth || ON_SERVER.acquisition) {
  const landing = new URL(window.location.href);
  void import('@/lib/startTelemetry')
    .then(({ startTelemetry }) => startTelemetry(landing))
    .catch(() => undefined);
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
