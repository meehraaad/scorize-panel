import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/lib/i18n';
import '@/styles/index.css';
import { App } from '@/app/App';
import { startCachePersistence } from '@/lib/api/persist';
import { reportWebVitals } from '@/lib/vitals';

// Answers this tab had before a reload (restored once the session names the same user).
startCachePersistence();
reportWebVitals();

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
