import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { queryClient } from '@/lib/api/queryClient';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

/*
 * The page-data rule (docs/performance.md): opening a page starts every request its first screen
 * needs together with its code, in the route's loader (`lazyPage(…, data)`). A request the page
 * itself starts after it renders is a waterfall. This opens every panel page against the fake Django
 * and fails on any first load that started after the route had loaded. (Refetches, e.g. after the
 * page marks something seen, are not waterfalls.)
 */

const SARA = 1; // applicant with a contract (src/mocks/applicant.ts)
const MARYAM = 2; // supervisor and writer (src/mocks/supervisor.ts, writer.ts)
const NIMA = 3; // seller
const REZA = 4; // sales manager
const ERFAN = 105; // a customer with history, purchases and payments (src/mocks/sales.ts)

interface PageCase {
  path: string;
  user: number;
  /** Requests allowed to start after the page renders, each with the reason. */
  later?: { key: string; why: string }[];
}

const PAGES: PageCase[] = [
  // Applicant panel.
  ...[
    '/',
    '/documents',
    '/documents/sop',
    '/documents/cv',
    '/documents/recommendation',
    '/documents/pl',
    '/documents/ps',
    '/documents/ds',
    '/contract',
    '/payments/501',
    '/services',
    '/services/packages/1',
    '/services/events/31',
    '/consultations',
    '/consultations/41',
  ].map((path) => ({ path, user: SARA })),
  {
    path: '/applications',
    user: SARA,
    later: [
      {
        key: 'professor-emails',
        why: 'below the fold, only for files with emails, and can run into hundreds of rows',
      },
    ],
  },
  {
    path: '/tickets',
    user: SARA,
    later: [{ key: '"messages"', why: "the thread's id comes from the list (backend item H55)" }],
  },
  // Sales panel.
  ...[
    '/sales',
    '/sales/leads',
    '/sales/leads?stage=new',
    '/sales/leads/consultations',
    '/sales/board',
    '/sales/month',
    '/sales/tasks',
    `/sales/customers/${String(ERFAN)}`,
    `/sales/customers/${String(ERFAN)}/purchases`,
    `/sales/customers/${String(ERFAN)}/payments`,
    `/sales/customers/${String(ERFAN)}/info`,
    `/sales/customers/${String(ERFAN)}/apply`,
    `/sales/customers/${String(ERFAN)}/offer`,
  ].map((path) => ({ path, user: NIMA })),
  ...[
    '/sales/manager',
    '/sales/manager/approvals',
    '/sales/manager/team',
    '/sales/manager/follow-ups',
  ].map((path) => ({ path, user: REZA })),
  // Supervisor panel.
  ...[
    '/supervisor',
    '/supervisor/files',
    '/supervisor/files/1227',
    '/supervisor/files/1227/documents',
    '/supervisor/files/1227/applications',
    '/supervisor/files/1227/activity',
    '/supervisor/tickets',
    '/supervisor/tasks',
    '/supervisor/reports',
  ].map((path) => ({ path, user: MARYAM })),
  // Writer panel.
  ...['/writer', '/writer/orders/1240'].map((path) => ({ path, user: MARYAM })),
  // Tickets pages: the thread's messages are chained after the list in the loader.
  ...['/supervisor/files/1227/tickets', '/writer/orders/1240/tickets'].map((path) => ({
    path,
    user: MARYAM,
    later: [{ key: '"messages"', why: "the thread's id comes from the list (backend item H55)" }],
  })),
  // Shared pages.
  { path: '/account', user: SARA },
  { path: '/settings', user: SARA },
];

/** Queries first loaded while `path` opens, and whether the load began after the route had. */
async function openAndRecord(path: string) {
  const fetches: { key: string; late: boolean }[] = [];
  let routed = false;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (
      event.type === 'updated' &&
      event.action.type === 'fetch' &&
      event.query.state.dataUpdateCount === 0
    )
      fetches.push({ key: event.query.queryHash, late: routed });
  });
  try {
    const router = renderApp(path);
    const update = () => {
      routed ||= router.state.initialized && router.state.navigation.state === 'idle';
    };
    update();
    const unsubscribeRouter = router.subscribe(update);
    await waitFor(() => {
      expect(routed).toBe(true);
    });
    unsubscribeRouter();
    // Settled: nothing in flight for a while, so dependent requests have had their chance to start.
    let quietSince = 0;
    await waitFor(() => {
      if (queryClient.isFetching() > 0) quietSince = 0;
      else quietSince ||= Date.now();
      expect(quietSince && Date.now() - quietSince).toBeGreaterThanOrEqual(300);
    });
    return { fetches, location: router.state.location.pathname + router.state.location.search };
  } finally {
    unsubscribe();
  }
}

describe('page data loads with the page, not after it', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it.each(PAGES)('$path', async ({ path, user, later = [] }) => {
    localStorage.setItem('scorize.mock.session', String(user));
    const { fetches, location } = await openAndRecord(path);

    // The page itself opened (no redirect to login or elsewhere).
    expect(location).toBe(path);
    const waterfalls = fetches
      .filter(({ late, key }) => late && !later.some((allowed) => key.includes(allowed.key)))
      .map(({ key }) => key);
    expect(waterfalls, 'started by the page after it rendered: add them to its route data').toEqual(
      [],
    );
  });
});
