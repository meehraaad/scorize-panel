import { workflowQuery, workflowHistoryQuery } from '@/features/assessments/workflowApi';
import { destinationOptionsQuery, destinationQuery } from '@/features/assessments/destinationApi';
import {
  createBrowserRouter,
  redirect,
  redirectDocument,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import {
  calculatorOptionsQuery,
  interviewQuery,
  snapshotsQuery,
  guidanceQuery,
  profileEvidenceQuery,
  documentLinksQuery,
  sharedFactsQuery,
} from '@/features/assessments/calculatorApi';
import { draftsQuery, healthQuery, optionsQuery } from '@/features/assessments/api';
import { myOnboardingQuery } from '@/features/hr/onboarding/me';
import { ONBOARDING_PATH } from '@/features/hr/paths';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { ApiError, api } from '@/lib/api/client';
import type { SessionUser } from '@/lib/auth/session';
import { safeNextPath, toRouterPath } from '@/features/auth/next';
import { accountQuery, notificationsQuery, unreadQuery } from '@/lib/account/api';
import { openingTaskList, openTaskQueries, taskPanelOf, tasksQuery } from '@/lib/tasks/api';
import { publicInvoiceQuery } from '@/lib/applicant/publicInvoice';
import { restoreCacheFor } from '@/lib/api/persist';
import { getRoles, isActiveStaff } from '@/lib/auth/roles';
import { queryClient } from '@/lib/api/queryClient';
import { START_PATH, loginHref, sessionQuery } from '@/lib/auth/session';
import { lazyPage, prefetchQueries } from '@/lib/router/lazyPage';
import { setPreloadRoutes } from '@/lib/router/preload';
import { callRatingsQuery } from '@/lib/sales/callRatings';
import { toPathways } from '@/panels/pathwayRoutes';
import { PANELS, canOpen, panelsFor, preferredPanel, startTarget } from '@/panels/registry';
import { panelHref, type PanelDefinition } from '@/panels/types';
import { ErrorPage, NotFoundPage, SectionError } from './ErrorPage';
import { AuthLayout } from './layouts/AuthLayout';
import { MeLayout } from './layouts/MeLayout';
import { PanelLayout } from './layouts/PanelLayout';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';
import { hubPanelOf, inboxTabOf } from './tasks/inbox';
import { BootFallback, PanelBootFallback, SharedLayout } from './layouts/SharedLayout';

/*
 * Route map
 *   /login                 AuthLayout   login, sign-up, password reset
 *   /start                 →            after login: the user's panel, or /choose
 *   /choose                             which panel to start in (several panels, first time or "ask")
 *   /finder                             the pathway finder alone (no panel menus)
 *   /account, /settings,   PanelLayout  shared pages, shown inside the last-used panel
 *   /me                                (/me: a staff member's own KPIs and pay)
 *   /, /supervisor, …      PanelLayout  one route tree per panel (src/panels/*), guarded by role
 *   /dev/components                     shared blocks gallery (dev builds only)
 *
 * Every panel's pages sit under a SectionError boundary, so a failing page keeps the header and menus.
 */

const CHOOSE_PATH = '/choose';

// Loaders run in parallel, so each one asks for the session; React Query sends a single request.
const currentUser = () => queryClient.query({ ...sessionQuery, staleTime: 'static' });

async function sellerOnlyInMe() {
  const user = await currentUser();
  return user && getRoles(user).includes('sales') ? null : redirect('/me');
}

/** A new hire whose form is still theirs to fill (whoami OB5): it opens first after login. */
const hasOpenForm = (user: SessionUser) =>
  ON_SERVER.hrOnboarding &&
  (user.staff?.onboarding === 'draft' || user.staff?.onboarding === 'returned');

/**
 * The data of a panel's frame (the bell's count: notifications, and staff's tasks waiting; locked
 * sections), started with the page's own.
 */
const prefetchFrame = (panel: PanelDefinition, user: SessionUser) => {
  // Before the page renders: it opens from this tab's last answers, if they were this user's.
  restoreCacheFor(user.id);
  const tasks = isActiveStaff(user) ? openTaskQueries(taskPanelOf(user, panel.id)) : [];
  prefetchQueries([unreadQuery, ...tasks, ...(panel.data?.() ?? [])]);
};

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

function toLogin(request: Request) {
  const url = new URL(request.url);
  return redirect(loginHref(url.pathname + url.search));
}

function panelRoutes(panel: PanelDefinition): RouteObject {
  return {
    // The applicant panel has no segment: a pathless layout at /panel/.
    ...(panel.path ? { path: panel.path } : {}),
    loader: async ({ request }: LoaderFunctionArgs) => {
      const user = await currentUser();
      if (!user) return toLogin(request);
      // No role for this panel: go to one the user can open (the API refuses the data anyway).
      if (!canOpen(user, panel)) return redirect(START_PATH);
      prefetchFrame(panel, user);
      return null;
    },
    Component: () => <PanelLayout panel={panel} />,
    ErrorBoundary: ErrorPage,
    HydrateFallback: PanelBootFallback,
    children: [
      {
        ErrorBoundary: SectionError,
        children: [...panel.routes, { path: '*', Component: NotFoundPage }],
      },
    ],
  };
}

const pageRoutes: RouteObject[] = [
  {
    Component: AuthLayout,
    ErrorBoundary: ErrorPage,
    HydrateFallback: BootFallback,
    children: [
      {
        path: 'login',
        // Already logged in → skip the page. A password-reset link always opens the form.
        loader: async ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.has('password_reset_token')) return null;
          const user = await queryClient.query({ ...sessionQuery, staleTime: 0 });
          if (!user) return null;
          const next = url.searchParams.get('next');
          if (!next) return redirect(START_PATH);
          const target = safeNextPath(next);
          const routerPath = toRouterPath(target);
          return routerPath ? redirect(routerPath) : redirectDocument(target);
        },
        ...lazyPage(() => import('@/features/auth/LoginPage'), ['auth']),
      },
      {
        // An invoice by its public link (the seller's SMS, the bank's return), signed out too.
        // Its owner, signed in, goes on to the payment page with the same query (`?from=bank`).
        path: 'pay/:token',
        loader: async ({ params, request }) => {
          const query = publicInvoiceQuery(params.token ?? '');
          const [user, invoice] = await Promise.all([
            queryClient.query({ ...sessionQuery, staleTime: 0 }),
            queryClient.query(query),
          ]);
          if (user && invoice?.payment_id)
            return redirect(
              `/payments/${String(invoice.payment_id)}${new URL(request.url).search}`,
            );
          return null;
        },
        ...lazyPage(() => import('@/features/contract/PublicInvoicePage'), ['contract']),
      },
    ],
  },
  {
    path: 'start',
    loader: async ({ request }) => {
      const user = await currentUser();
      if (!user) return toLogin(request);
      if (hasOpenForm(user)) return redirect(ONBOARDING_PATH);
      const target = startTarget(user);
      return redirect(target === 'choose' ? CHOOSE_PATH : panelHref(target));
    },
    HydrateFallback: BootFallback,
  },
  {
    path: 'choose',
    loader: async ({ request }) => {
      const user = await currentUser();
      if (!user) return toLogin(request);
      // One panel: nothing to choose.
      return panelsFor(user).length < 2 ? redirect(START_PATH) : null;
    },
    ...lazyPage(() => import('./ChoosePanelPage')),
    ErrorBoundary: ErrorPage,
    HydrateFallback: BootFallback,
  },
  // The pathway finder alone: the logo and the quiz, no panel menus (links in ads and messages).
  // Its loader comes with its page, so the first load only knows the path.
  {
    path: 'finder',
    lazy: () => import('@/features/pathways/FinderPage').then((page) => page.alone),
    ErrorBoundary: ErrorPage,
    HydrateFallback: BootFallback,
  },
  {
    loader: async ({ request }) => {
      const user = await currentUser();
      if (!user) return toLogin(request);
      prefetchFrame(preferredPanel(user), user);
      return null;
    },
    Component: SharedLayout,
    ErrorBoundary: ErrorPage,
    HydrateFallback: PanelBootFallback,
    children: [
      {
        ErrorBoundary: SectionError,
        children: [
          {
            path: 'account',
            ...lazyPage(() => import('@/features/account/AccountPage'), ['account'], {
              data: () => [accountQuery, notificationsQuery],
              skeleton: 'dashboard',
            }),
          },
          {
            // Staff's tasks and notifications, whatever panel they work in (the bell's page).
            path: 'tasks',
            ...lazyPage(() => import('./tasks/TasksHubPage'), ['tasks', 'account'], {
              skeleton: 'dashboard',
              guard: async ({ request }) => {
                const user = await currentUser();
                if (!user || !isActiveStaff(user)) return redirect('/account#notifications');
                // Its data depends on whose tasks it shows: the address's panel, else the last one used.
                const query = new URL(request.url).searchParams;
                const panel = hubPanelOf(user, query);
                prefetchQueries(
                  inboxTabOf(query.get('tab')) === 'notifications'
                    ? [notificationsQuery]
                    : [tasksQuery(panel), openingTaskList(panel, request.url)],
                );
                return null;
              },
            }),
          },
          {
            path: 'settings',
            ...lazyPage(() => import('@/features/settings/SettingsPage'), [], { skeleton: 'form' }),
          },
          {
            // A staff member's own pages: KPIs and pay, plus sales performance and call ratings.
            path: 'me',
            Component: MeLayout,
            children: [
              {
                index: true,
                // No data on open: my pay is read only after I type my password.
                ...lazyPage(() => import('@/features/hr/me/MyPayPage'), ['hr'], {
                  skeleton: 'form',
                }),
              },
              {
                // The new hire's personal details form (replaces the Porsline link).
                path: 'onboarding',
                ...lazyPage(() => import('@/features/hr/onboarding/OnboardingPage'), ['hr'], {
                  data: () => [myOnboardingQuery],
                  skeleton: 'form',
                  guard: () => Promise.resolve(ON_SERVER.hrOnboarding ? null : redirect('/me')),
                }),
              },
              {
                path: 'sales',
                // No data on open: the month is read only after the seller types their password.
                ...lazyPage(() => import('@/features/sales/MonthPage'), ['sales'], {
                  skeleton: 'form',
                  guard: sellerOnlyInMe,
                }),
              },
              {
                path: 'call-ratings',
                ...lazyPage(() => import('@/features/sales/CallRatingsPage'), ['sales'], {
                  data: () => [callRatingsQuery('mine')],
                  skeleton: 'list',
                  guard: sellerOnlyInMe,
                }),
              },
            ],
          },
        ],
      },
    ],
  },
  // Earlier addresses of sections that moved. The messages section (its own panel, then the sales
  // management area): now sections of the management panel.
  ...[
    ['messages', '/founders/messages'],
    ['messages/ready', '/founders/messages/ready'],
    ['messages/access', '/founders/access'],
    ['sales/manager/messages', '/founders/messages'],
    ['sales/manager/messages/ready', '/founders/messages/ready'],
    ['sales/manager/access/*', '/founders/access'],
    // The attendance panel's addresses: now the HR panel's attendance section.
    ['attendance', '/hr/attendance'],
    ['attendance/month', '/hr/attendance/month'],
    ['attendance/settings', '/hr/attendance/settings'],
    ['attendance/*', '/hr/attendance'],
  ].map(([path = '', to = '']) => ({ path, loader: () => redirect(to) })),
  // Migration pathways: from the management panel to the sales and the marketing manager's areas.
  { path: 'founders/pathways', loader: toPathways },
  { path: 'founders/pathways/:id', loader: toPathways },
  ...PANELS.map(panelRoutes),
  // The assessment preview pages: development, and the test server's build
  // (VITE_ASSESSMENT_PREVIEW=true). Production builds drop them; Django also refuses
  // their API outside local mode.
  ...(import.meta.env.DEV || import.meta.env.VITE_ASSESSMENT_PREVIEW === 'true'
    ? [
        {
          path: 'dev/assessments',
          loader: async ({ request }: LoaderFunctionArgs) => {
            // This standalone development route has no panel session boundary.
            // Keep its guard independent of StrictMode's disabled frame observer.
            const user = await queryClient.query({
              queryKey: ['assessment-management', 'viewer'],
              queryFn: async () => {
                try {
                  return await api<SessionUser>('/profile/auth/v1/whoami/');
                } catch (error) {
                  if (error instanceof ApiError && (error.status === 401 || error.status === 403))
                    return null;
                  throw error;
                }
              },
              staleTime: 0,
            });
            if (user) queryClient.setQueryData(sessionQuery.queryKey, user);
            return user ? null : toLogin(request);
          },
          ErrorBoundary: ErrorPage,
          HydrateFallback: BootFallback,
          children: [
            {
              index: true,
              ...lazyPage(() => import('@/features/assessments/ManagementPage'), ['assessments'], {
                data: () => [draftsQuery(), optionsQuery, healthQuery],
                skeleton: 'form',
              }),
            },
          ],
        },
        {
          path: 'dev/assessment-destinations',
          loader: async ({ request }: LoaderFunctionArgs) =>
            (await currentUser()) ? null : toLogin(request),
          ...lazyPage(() => import('@/features/assessments/DestinationPage'), ['assessments'], {
            data: ({ request }) => {
              const session = new URL(request.url).searchParams.get('session');
              return session
                ? [
                    destinationOptionsQuery,
                    destinationQuery(session),
                    snapshotsQuery(session, 1),
                    sharedFactsQuery,
                  ]
                : [destinationOptionsQuery];
            },
            skeleton: 'form',
          }),
          HydrateFallback: BootFallback,
        },
        {
          path: 'dev/assessment-workflow',
          loader: async ({ request }: LoaderFunctionArgs) =>
            (await currentUser()) ? null : toLogin(request),
          ...lazyPage(() => import('@/features/assessments/WorkflowPage'), ['assessments'], {
            data: ({ request }) => {
              const id = new URL(request.url).searchParams.get('session') ?? '';
              return /^[a-f0-9-]{36}$/i.test(id)
                ? [
                    calculatorOptionsQuery,
                    workflowQuery(id),
                    workflowHistoryQuery(id),
                    sharedFactsQuery,
                    documentLinksQuery(id),
                  ]
                : [calculatorOptionsQuery];
            },
            skeleton: 'form',
          }),
          HydrateFallback: BootFallback,
        },
        {
          path: 'dev/assessment-calculators',
          ...lazyPage(() => import('@/features/assessments/CalculatorPage'), ['assessments'], {
            data: ({ request }) => {
              const params = new URL(request.url).searchParams;
              const id = params.get('session') ?? '';
              const country = params.get('country') === 'australia' ? 'australia' : 'canada';
              return /^[a-f0-9-]{36}$/i.test(id)
                ? [
                    calculatorOptionsQuery,
                    profileEvidenceQuery(id, country),
                    sharedFactsQuery,
                    documentLinksQuery(id),
                    interviewQuery(id),
                    snapshotsQuery(id),
                    guidanceQuery(id),
                  ]
                : [calculatorOptionsQuery];
            },
            skeleton: 'form',
          }),
          HydrateFallback: BootFallback,
        },
      ]
    : []),
  // Developer-only gallery of the shared blocks (src/components/ui). Vite drops it from builds.
  ...(import.meta.env.DEV
    ? [
        {
          path: 'dev/components',
          ...lazyPage(() => import('./dev/ComponentsPage')),
          HydrateFallback: BootFallback,
        },
      ]
    : []),
];

// The shell's own boundary: if WorkspaceLayout itself fails, the user still gets our error page.
export const routes: RouteObject[] = [
  { Component: WorkspaceLayout, ErrorBoundary: ErrorPage, children: pageRoutes },
];

setPreloadRoutes(routes);

export const createRouter = () => createBrowserRouter(routes, { basename: BASENAME });
