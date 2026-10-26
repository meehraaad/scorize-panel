import type { Metric } from 'web-vitals';
import { API_BASE } from '@/lib/api/client';

/*
 * Real users' speed (docs/performance.md, "Measure"): Core Web Vitals (LCP: main content shown,
 * INP: answer to a tap, CLS: layout jumps) plus FCP and TTFB, per page, sent to Django when the tab
 * is hidden. Pages are sent as patterns (`/sales/customers/:id`), never with ids.
 */

/** Off until Django's endpoint ships (backend-changes.md V1): nothing loads or is sent. */
export const VITALS_ON_SERVER: boolean = false;

const ENDPOINT = `${API_BASE}/metrics/v1/vitals/`;

interface Report {
  name: Metric['name'];
  value: number;
  rating: Metric['rating'];
  navigation: Metric['navigationType'];
  page: string;
}

/** A path without record ids: `/sales/customers/105/payments` → `/sales/customers/:id/payments`. */
export const pagePattern = (path: string) => path.replace(/\/\d+(?=\/|$)/g, '/:id');

export function reportWebVitals() {
  if (!VITALS_ON_SERVER) return;
  const queue: Report[] = [];

  const flush = () => {
    if (queue.length === 0) return;
    const body = JSON.stringify({
      build: import.meta.env.VITE_APP_BUILD,
      metrics: queue.splice(0),
    });
    // sendBeacon survives the tab closing; fetch with keepalive is the fallback.
    if (!navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' })))
      void fetch(ENDPOINT, {
        method: 'POST',
        body,
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => undefined);
  };
  const add = (metric: Metric) => {
    queue.push({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigation: metric.navigationType,
      page: pagePattern(window.location.pathname),
    });
  };

  // Its own chunk: never part of the first load.
  void import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    for (const on of [onCLS, onFCP, onINP, onLCP, onTTFB]) on(add);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
