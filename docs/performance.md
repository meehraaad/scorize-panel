# Performance: how pages stay fast

The target: a page opens in **one round trip**, whether it is the first page of the visit or a
click inside the panel. Its code, its dictionaries and every request its first screen needs start
together, the moment the URL is known, never one after another (a "waterfall").

## Page data: the rule for every page

Each route declares what its page shows first, as the third argument of `lazyPage`
(`src/lib/router/lazyPage.ts`):

```tsx
{
  path: 'customers/:id/offer',
  ...lazyPage(() => import('@/features/sales/OfferPage'), ['sales'], ({ params }) => {
    const id = idParam(params.id);
    return id === null ? [] : [customerQuery(id), offerQuery(id)];
  }),
},
```

- **List every query the page reads on its first render**: `useSuspenseQuery` and `useQuery`
  alike, in the page and in its child components. Use the same factory and the same arguments
  the page starts with (page 1, the default tab and filters, the URL's search params), so the
  query keys match and the page finds the data already loading.
- **Read from the URL only** (`params`, `request.url`). Page state that starts from the URL
  (e.g. the leads `?stage=` tab) gets one parser shared by the page and the route
  (`leadFilterOf`); defaults that both need go next to the query factory (`firstLeadQuery`).
- **Nested routes each list their own data.** Loaders of a layout and its child run in parallel,
  so a customer tab's data starts with the customer, not after the layout renders.
- **The panel frame** (header badge, locked nav) is prefetched by the panel route itself:
  `unreadQuery` for every panel, plus `PanelDefinition.data` (the applicant panel's `accessQuery`).
  Pages don't repeat it.
- **Data that depends on other data** (the tickets thread comes from the list) is chained in the
  loader, `queryClient.query(a).then(…)`, so it starts as soon as `a` arrives instead of after the
  page renders. Better still, ask Django for both in one response (backend-changes.md H52).
- **What may load later**, on purpose: data behind a click (a dialog, a collapsed section,
  `enabled: open`), the next page of a list, and below-the-fold sections that are costly and often
  empty (professor emails). Say why in a comment, and in the test's `later` list.
- Loaders never `await` data: navigation is not held up. A failure surfaces when the page reads
  the query, inside the page's error boundary.

### The guard

`src/app/pageData.test.tsx` opens every applicant and sales page against the fake Django and fails
when a query is first loaded after the route has loaded, which is exactly a waterfall. **A new
page goes into its `PAGES` list.** If it fails, the message names the query keys: add them to the
route's data, or to `later` with the reason.

## Roadmap

Done in phase 1: the rule above, the guard, and every applicant and sales page following it
(sales Today was prefetching an endpoint the page no longer read; offer, customer tabs, tasks,
leads, consultations and the manager's team and follow-up pages each started requests only after
rendering).

| Phase | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Win                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 2     | **Loading states.** (a) Page-shaped skeletons instead of the `PageLoader` spinner: a few shared blocks by page kind (dashboard, list, detail with tabs, form); each route names its kind in `handle`, and the panel's Suspense fallback draws it under the real header. (b) A thin top progress bar while a navigation waits for code (shown after ~150 ms), so a click always answers. (c) The app frame (header shape + skeleton) as `BootFallback` on the first visit instead of a blank page. (d) No flicker: keep the 300 ms delay, and once shown keep a skeleton ≥ 400 ms. (e) The guard checks every route names its skeleton | The user sees the page's shape at once, never a spinner or a blank screen |
| 3     | Add the supervisor, writer, account and settings pages to the guard and fix what it finds (their routes already use `lazyPage(…, data)`, with the same queries as before; not yet audited; supervisor Today may prefetch an unused endpoint, as sales Today did)                                                                                                                                                                                                                                                                                                                                                                      | Same rule everywhere                                                      |
| 4     | **Preload on intent**: on hover, focus or touch of an in-app link (and the panel's nav items once the page is idle) load the target route's chunk and run its data, through `matchRoutes(routes, to)`. The click then renders from cache                                                                                                                                                                                                                                                                                                                                                                                              | In-panel navigation feels instant                                         |
| 5     | **Cache.** (a) `gcTime` 5 → 30 min, so going back to a page later shows it at once and refreshes behind it (now it is a skeleton after 5 idle minutes). (b) Mutations whose response is the updated object write it into the cache (`setQueryData`) instead of refetching it; keep the wide invalidation for the lists it affects. (c) Optimistic updates for quick actions (stage change, mark done, seen), as the board's drag already does. (d) Decide on persisting the cache across reloads (IndexedDB, keyed by user and app version, cleared on logout): instant reopen of the app, but customer data stays on the device      | Return visits and actions without waiting                                 |
| 6     | Measure real users: report LCP, INP and CLS (`web-vitals`) per page to Django, plus a bundle-size check in CI against the budget in architecture.md                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Regressions are seen, not guessed                                         |
| 7     | Backend (backend-changes.md): H52; a response-time budget for panel endpoints (p95 under 300 ms, `Server-Timing` header); `select_related`/`prefetch_related` on list views; Brotli next to the pre-gzipped assets                                                                                                                                                                                                                                                                                                                                                                                                                    | Each round trip is shorter                                                |

### Caching today (audit, phase 1)

Already right: hashed assets are `immutable` for a year and precached by the service worker,
`index.html` is `no-cache`; `whoami` is preloaded from `index.html`. Queries are fresh for 30 s by
default (longer for slow-changing data: access, gates, products 5 min; writing drafts never
refetch while open), so moving between pages within that time sends no request, and after it shows
the cached page at once and refreshes in the background. Live lists poll every 60 s (sales) or
5 min (supervisor) only while the tab is visible. A mutation invalidates its panel's queries: only
those on screen refetch, the rest refetch when next shown. Logout and login clear the cache;
a language change refetches (Django words some fields per language).
