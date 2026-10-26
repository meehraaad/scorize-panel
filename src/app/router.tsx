import {
  createBrowserRouter,
  redirect,
  redirectDocument,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import { safeNextPath, toRouterPath } from '@/features/auth/next';
import { accountQuery, unreadQuery } from '@/lib/account/api';
import { queryClient } from '@/lib/api/queryClient';
import { START_PATH, loginHref, sessionQuery } from '@/lib/auth/session';
import { lazyPage, prefetchQueries } from '@/lib/router/lazyPage';
import { PANELS, canOpen, panelsFor, preferredPanel, startTarget } from '@/panels/registry';
import { panelHref, type PanelDefinition } from '@/panels/types';
import { ErrorPage, NotFoundPage, SectionError } from './ErrorPage';
import { AuthLayout } from './layouts/AuthLayout';
import { PanelLayout } from './layouts/PanelLayout';
import { BootFallback, SharedLayout } from './layouts/SharedLayout';

/*
 * Route map
 *   /login                 AuthLayout   login, sign-up, password reset
 *   /start                 →            after login: the user's panel, or /choose
 *   /choose                             which panel to start in (several panels, first time or "ask")
 *   /account, /settings    PanelLayout  shared pages, shown inside the last-used panel
 *   /, /supervisor, …      PanelLayout  one route tree per panel (src/panels/*), guarded by role
 *   /dev/components                     shared blocks gallery (dev builds only)
 *
 * Every panel's pages sit under a SectionError boundary, so a failing page keeps the header and menus.
 */

const CHOOSE_PATH = '/choose';

// Loaders run in parallel, so each one asks for the session; React Query sends a single request.
const currentUser = () => queryClient.query({ ...sessionQuery, staleTime: 'static' });

/** The data of a panel's frame (header badge, locked sections), started with the page's own. */
const prefetchFrame = (panel: PanelDefinition) => {
  prefetchQueries([unreadQuery, ...(panel.data?.() ?? [])]);
};

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
      prefetchFrame(panel);
      return null;
    },
    Component: () => <PanelLayout panel={panel} />,
    ErrorBoundary: ErrorPage,
    HydrateFallback: BootFallback,
    children: [
      {
        ErrorBoundary: SectionError,
        children: [...panel.routes, { path: '*', Component: NotFoundPage }],
      },
    ],
  };
}

export const routes: RouteObject[] = [
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
    ],
  },
  {
    path: 'start',
    loader: async ({ request }) => {
      const user = await currentUser();
      if (!user) return toLogin(request);
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
  {
    loader: async ({ request }) => {
      const user = await currentUser();
      if (!user) return toLogin(request);
      prefetchFrame(preferredPanel(user));
      return null;
    },
    Component: SharedLayout,
    ErrorBoundary: ErrorPage,
    HydrateFallback: BootFallback,
    children: [
      {
        ErrorBoundary: SectionError,
        children: [
          {
            path: 'account',
            ...lazyPage(
              () => import('@/features/account/AccountPage'),
              ['account'],
              () => [accountQuery],
            ),
          },
          { path: 'settings', ...lazyPage(() => import('@/features/settings/SettingsPage')) },
        ],
      },
    ],
  },
  ...PANELS.map(panelRoutes),
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

export const createRouter = () =>
  createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') });
