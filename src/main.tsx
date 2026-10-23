import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/lib/i18n';
import '@/styles/index.css';
import { App } from '@/app/App';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

// Dev only: answer API calls from src/mocks instead of Django. Stripped from production builds.
if (import.meta.env.DEV && import.meta.env.VITE_API_MOCKS === 'true') {
  const { startMocks } = await import('@/mocks/browser');
  await startMocks();
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
