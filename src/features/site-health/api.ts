import type { ReportDays } from '@/components/ui/ReportPeriod';
import { api } from '@/lib/api/client';

type ProbeTarget = 'site' | 'panel' | 'api' | 'login' | 'consultation' | 'checkout';
type Metric = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';

interface RequestStats {
  surface: 'site' | 'api';
  samples: number;
  errors: number;
  p95_ms: number | null;
}

export interface SiteHealth {
  checked_at: string;
  dependencies: Record<'database' | 'session_cache', boolean>;
  queues: Record<'celery' | 'realtime' | 'ai', string | null>;
  probes: {
    target: ProbeTarget;
    checked_at: string | null;
    duration_ms: number | null;
    state: 'up' | 'down' | 'stale' | 'unknown';
    checks: number;
    passed: number;
  }[];
  provider_failures_last_hour: Partial<
    Record<'login_sms' | 'payment_start' | 'payment_verify', number | null>
  >;
  surfaces: (RequestStats & { sampled_errors: number })[];
  routes: (RequestStats & { route: string; support_code: string })[];
  crash_count: number;
  crashes: {
    surface: 'site' | 'panel';
    page: string;
    build: string;
    fingerprint: string;
    count: number;
    last_at: string;
    support_code: string;
  }[];
  vitals: {
    page: string;
    metrics: Record<
      Metric,
      {
        p75: number;
        count: number;
        rating: 'good' | 'needs-improvement' | 'poor';
      } | null
    >;
  }[];
}

export const siteHealthQuery = (days: ReportDays = 7) => ({
  queryKey: ['site-health', days],
  queryFn: () => api<SiteHealth>(`/metrics/v1/site-health/?days=${days}`),
  refetchInterval: 60_000,
  meta: { persist: false },
});
