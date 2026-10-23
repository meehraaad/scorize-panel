import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { RouterProvider } from 'react-router';
import { queryClient } from '@/lib/api/queryClient';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';
import { createRouter } from './router';

// The service worker code is only bundled when the PWA is switched on (VITE_ENABLE_PWA).
const UpdatePrompt =
  import.meta.env.VITE_ENABLE_PWA === 'true' ? lazy(() => import('@/pwa/UpdatePrompt')) : null;

export function App() {
  const [router] = useState(createRouter);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* Boot fallback: plain canvas while the session and dictionary load (usually < 1 frame). */}
        <Suspense fallback={<div className="min-h-dvh" />}>
          <RouterProvider router={router} />
          {UpdatePrompt && <UpdatePrompt />}
        </Suspense>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
