import { http, HttpResponse } from 'msw';
import type { AcquisitionReport } from '@/features/marketing/acquisitionApi';
import type { SiteHealth } from '@/features/site-health/api';

export const telemetryHandlers = [
  http.get('/api/metrics/v1/site-health/', () =>
    HttpResponse.json({
      checked_at: '2026-11-24T12:00:00Z',
      dependencies: { database: true, session_cache: true },
      queues: { celery: null, realtime: null, ai: null },
      probes: [
        {
          target: 'panel',
          checked_at: null,
          duration_ms: null,
          state: 'unknown',
          checks: 0,
          passed: 0,
        },
      ],
      provider_failures_last_hour: { login_sms: 1 },
      surfaces: [],
      routes: [],
      crashes: [],
      crash_count: 0,
      vitals: [],
    } satisfies SiteHealth),
  ),
  http.get('/api/marketing/v1/acquisition/', () =>
    HttpResponse.json({
      total: {
        visits: 100,
        cta: 50,
        started: 45,
        reserved: 30,
        paid: 25,
        bookings: 30,
        paid_bookings: 25,
        revenue_toman: 2_000_000,
      },
      cohorts: [],
    } satisfies AcquisitionReport),
  ),
];
