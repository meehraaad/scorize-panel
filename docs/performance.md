# Performance: how pages stay fast

The target: a page opens in **one round trip** or less, whether it is the first page of the visit
or a click inside the panel, and while anything loads the user sees the page's shape, never a
spinner or a blank screen. Five rules get there; each is enforced by a test or a CI step.

| Rule                                          | Where                                       | Enforced by                   |
| --------------------------------------------- | ------------------------------------------- | ----------------------------- |
| Page data loads with the page's code          | `lazyPage(…, { data })`                     | `src/app/pageData.test.tsx`   |
| Every page has a loading shape                | `lazyPage(…, { skeleton })`, `PageSkeleton` | `src/app/skeletons.test.ts`   |
| The next page starts loading before the click | `src/lib/router/preload.ts`                 | `src/app/preload.test.tsx`    |
| Answers are reused, not refetched             | `src/lib/api/queryClient.ts`, `persist.ts`  | `src/lib/api/persist.test.ts` |
| The first load stays small                    | `scripts/check-size.mjs` (`pnpm size`)      | CI, after `pnpm build`        |

## 1. Page data: no waterfalls

Each route declares what its page shows first (`src/lib/router/lazyPage.ts`):

```tsx
{
  path: 'customers/:id/offer',
  ...lazyPage(() => import('@/features/sales/OfferPage'), ['sales'], {
    data: ({ params }) => {
      const id = idParam(params.id);
      return id === null ? [] : [customerQuery(id), offerQuery(id)];
    },
    skeleton: 'form',
  }),
},
```

- **List every query the page reads on its first render**: `useSuspenseQuery` and `useQuery`
  alike, in the page and in its child components. Use the same factory and the same arguments
  the page starts with (page 1, the default tab and filters, the URL's search params), so the
  query keys match and the page finds the data already loading.
- **Read from the URL only** (`params`, `request.url`). Page state that starts from the URL gets one
  parser shared by the page and the route (`leadFilterOf`, `firstLeadQuery`, `firstCasesQuery`).
- **Nested routes each list their own data.** Loaders of a layout and its child run in parallel,
  so a customer tab's data starts with the customer, not after the layout renders.
- **The panel frame** (header badge, locked nav) is prefetched by the panel route: `unreadQuery`
  for every panel, plus `PanelDefinition.data` (the applicant panel's `accessQuery`).
- **Data that depends on other data** is chained in the loader, `queryClient.query(a).then(…)`,
  so it starts as soon as `a` arrives instead of after the page renders: `prefetchTickets` (the
  thread's id comes from the list). Better still, Django sends both at once (backend-changes H55).
- **What may load later**, on purpose: data behind a click (a dialog, a collapsed section,
  `enabled: open`), the next page of a list, and below-the-fold sections that are costly and
  often empty (professor emails). Say why in a comment, and in the test's `later` list.
- Loaders never `await` data: navigation is not held up. A failure surfaces when the page reads
  the query, inside the page's error boundary.

**The guard**: `pageData.test.tsx` opens every panel page against the fake Django and fails when a
query is first loaded after the route has loaded, which is exactly a waterfall. **A new page goes
into its `PAGES` list.**

## 2. Loading states: the page's shape, never a spinner

- **Skeletons by page kind** (`PageSkeleton` in `components/ui/Skeleton.tsx`): `dashboard`,
  `list`, `detail`, `customer` (the sales customer page: its dark card, tabs and summary), `form`,
  `board`, `chat`, and `tab` for the body of a tab inside a page that keeps its own frame
  (customer, case file). Each page directly under a panel names its kind in
  `lazyPage(…, { skeleton })`; the panel's Suspense boundary draws it under the real header and
  menu. `skeletons.test.ts` fails when a panel page names none. Previewed at `/dev/components`.
- **No flash, no flicker**: a skeleton fades in after 150 ms (`animate-appear`), so fast loads show
  nothing; once shown, React keeps a Suspense fallback at least 300 ms, so it never blinks.
- **Sections inside a page** (dashboards whose parts load on their own) use `QuerySection` with
  `SkeletonRows`, so one slow or failing section doesn't hold up the others.
- **A click always answers**: `NavigationProgress`, a thin bar at the top while the next page's
  code or data is on its way (after 150 ms; it slides from the start side in both directions).
- **First visit**: `PanelBootFallback` draws the header capsule and the page's skeleton while the
  session check and the first code load, instead of a blank screen.

## 3. Preload on intent

`useIntentPreload` (mounted by the panel frame) starts a link's route code and route data when
a mouse rests on it for 80 ms, or it is focused (keyboard) or touched (phones: ~100–300 ms before
the click). `useIdlePreload` fetches the code of the panel's nav pages once the browser is idle.
Route loaders only start queries, so running them early is safe: React Query de-duplicates, fresh
data is not fetched again, and repeats within 10 s are skipped. Links to other sites, new tabs and
downloads are ignored.

## 4. Cache

- **Fresh for 30 s by default** (longer for slow-changing data: access, gates, products 5 min;
  writing drafts never refetch while open): moving between pages within that time sends no
  request. After it, the cached page shows at once and refreshes in the background.
- **Kept 30 min** (`gcTime`): going back to a page shows it at once.
- **Live lists poll** (sales 60 s, supervisor 5 min) only while the tab is visible.
- **After an action** the panel's queries are invalidated: those on screen refetch, the rest when
  next shown. Answers that carry the new state go straight into the cache (customer info, writing
  drafts, a sent ticket message). Quick actions update at once and roll back if refused (board
  drag, task done).
- **Survives a reload of the tab** (`src/lib/api/persist.ts`): the cache is saved in
  sessionStorage (this tab only, gone when it closes) and put back only after the session check
  names the same user. The session is never saved; logout and login wipe it; an hour, a new
  build or another language discards it.
- **Static files**: hashed assets are `immutable` for a year, `index.html` is `no-cache`, files are
  pre-gzipped (`nginx.conf`, `Dockerfile`). The service worker (offline precache) is off until
  the PWA milestone (`VITE_ENABLE_PWA`, docs/PWA.md).
- A language change refetches (Django words some fields per language).

## 5. Measure

- **First-load budget in CI**: `pnpm size` sums the gzip size of what `dist/index.html` loads
  (scripts, preloaded modules, stylesheets) and fails above JS 170 KB / CSS 18 KB. Today: JS
  ≈ 162 KB, CSS ≈ 15 KB. Raise a budget only on purpose, in review.
- **Real users** (`src/lib/vitals.ts`): LCP, INP, CLS, FCP and TTFB per page pattern, sent with
  `sendBeacon` when the tab is hidden. Off (and not even loaded) until Django's endpoint ships
  (backend-changes V1); the `web-vitals` library is its own chunk.

## Still to do

| Where  | Work                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Django | backend-changes H55 (tickets in one request), V1 (speed reports; then set `VITALS_ON_SERVER`), V2 (p95 under 300 ms, `Server-Timing`), V3 (no N+1), V4 (compressed API answers) |
| Panel  | Brotli next to the pre-gzipped assets needs an nginx image with the brotli module (the `Dockerfile` uses `nginx-unprivileged`)                                                  |
| Panel  | The service worker (PWA milestone): repeat visits then load the app's code from the device, even offline                                                                        |
