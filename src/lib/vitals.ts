import type { Metric } from 'web-vitals';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { submitTelemetry, telemetryAllowed, telemetryPage } from '@/lib/browserTelemetry';

/*
 * Real users' speed (docs/performance.md, "Measure"): Core Web Vitals (LCP: main content shown,
 * INP: answer to a tap, CLS: layout jumps) plus FCP and TTFB, per page, sent to Django when the tab
 * is hidden. Pages are sent as patterns (`/sales/customers/:id`), never with ids.
 */

interface Report {
  name: Metric['name'];
  value: number;
  rating: Metric['rating'];
  navigation: Metric['navigationType'];
  page: string;
}

export function reportWebVitals(pathname: string) {
  if (!ON_SERVER.siteHealth || !telemetryAllowed()) return;
  // Core Web Vitals describe this document load. SPA route changes do not reset the observers.
  const page = telemetryPage(pathname);
  const queue: Report[] = [];
  const flush = () => {
    if (queue.length > 0) {
      submitTelemetry('vitals/', {
        build: import.meta.env.VITE_APP_BUILD,
        metrics: queue.splice(0),
      });
    }
  };
  const add = (metric: Metric) => {
    queue.push({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigation: metric.navigationType,
      page,
    });
  };

  // Its own chunk: never part of the first load.
  void import('web-vitals')
    .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      for (const on of [onCLS, onFCP, onINP, onLCP, onTTFB]) on(add);
      // The observers flush their own final measurements on visibilitychange first.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
      });
      window.addEventListener('pagehide', flush);
    })
    .catch(() => undefined);
}
