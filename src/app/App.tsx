import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from '@/components/ui/Toast';
import { queryClient } from '@/lib/api/queryClient';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';
import { createRouter } from './router';

// The service worker code is only bundled when the PWA is switched on (VITE_ENABLE_PWA).
const UpdatePrompt =
  import.meta.env.VITE_ENABLE_PWA === 'true' ? lazy(() => import('@/pwa/UpdatePrompt')) : null;

export function App() {
  const [router] = useState(createRouter);
  // Phones keep a tab (or the home-screen app) open for days: load a new deploy when it comes back.
  // Its own small chunk, so the first load stays in budget.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let done = false;
    void import('@/lib/router/newBuild').then(({ watchForNewBuild }) => {
      if (!done) stop = watchForNewBuild(router);
    });
    return () => {
      done = true;
      stop?.();
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* Boot fallback: plain canvas while the session and dictionary load (usually < 1 frame). */}
        <Suspense fallback={<div className="min-h-dvh" />}>
          <RouterProvider router={router} />
          <Toaster />
          {UpdatePrompt && <UpdatePrompt />}
        </Suspense>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
