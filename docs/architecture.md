# Architecture

## Folder layout

```
src/
├── main.tsx               Entry: i18n, global CSS, optional API mocks, render <App>
├── app/                   Assembles everything (top layer)
│   ├── App.tsx            Providers: React Query, theme, router, PWA update prompt
│   ├── router.tsx         Route map: /login, /start, shared pages, one tree per panel
│   ├── ErrorPage.tsx      Layout-level error page, in-panel SectionError, 404
│   └── layouts/
│       ├── AuthLayout     Pages outside panels (login, sign-up, reset; later terms, inactive)
│       ├── PanelLayout    Frame shared by every panel: header + panel menu, account menu, tabs
│       ├── AccountMenu    Who is logged in, panel switcher, settings, logout
│       ├── BottomTabs     Mobile bar (≤ 4 tabs + "More" sheet with the rest)
│       └── SharedLayout   /account and /settings, shown inside the last-used panel
├── panels/                One folder per panel: its navigation and its routes
│   ├── types.ts           PanelDefinition, NavItem, panelHref()
│   ├── registry.ts        All panels (order = default priority), panelsFor(user), preferredPanel()
│   ├── applicant/         /panel/            every account (guest state without a contract)
│   ├── supervisor/        /panel/supervisor/
│   ├── writer/            /panel/writer/
│   └── sales/             /panel/sales/
├── features/<section>/    Pages and their logic (auth, home, settings, …): Page.tsx (default
│                          export), components/, api.ts, hooks. Used by panels.
├── components/            Shared UI; components/ui/ = design-system primitives
├── lib/                   Infrastructure (bottom layer)
│   ├── api/               fetch client (session cookie + CSRF), React Query client
│   ├── auth/              session (whoami), roles (same rules as Django), logout
│   ├── i18n/              i18next setup, locales config, Intl formatters (Jalali dates)
│   ├── router/            lazyPage(): page chunk + its dictionaries in parallel
│   └── theme/             Light / dark / system theme
├── locales/<lang>/        Dictionaries: common.json + one per feature namespace. fa is the source
├── styles/                tokens.css (design tokens), index.css (Tailwind + base)
├── mocks/                 MSW fake Django for `pnpm dev:mock` and tests
├── pwa/                   Service-worker registration + update prompt
└── test/                  Vitest setup, MSW server, renderApp()
```

### Layers

`lib` + `components` ← `features` ← `panels` ← `app`. A layer imports only from layers to its
left, and a feature never imports another feature (shared code moves to `lib` or `components`).
ESLint (`no-restricted-imports` in `eslint.config.js`) enforces this; tests are exempt.

### Panels and roles

- `lib/auth/roles.ts` turns `whoami` into roles with the same rules as the Django site
  (`is_seller`, `is_executer`, `can_write_*`, …). Several roles at once are normal.
- `panels/registry.ts` lists every panel. A user sees the panels their roles allow; one with
  several gets a switcher in the account menu and the "More" sheet, and the header names the panel.
- Each panel route has a loader: no session → login; no role → `/start`. The API still checks
  every request; this only keeps people out of UI they can't use.
- `/start` sends a user to their last-used panel (if still allowed), else the first in registry
  order, so staff land in their work panel.
- Adding a panel: a folder in `src/panels/` exporting a `PanelDefinition`, one line in
  `registry.ts`, its role in `roles.ts`, its strings under `panels.<id>` in every `common.json`.

### Errors

- A failing page is replaced by `SectionError` **inside** the panel: header and menus keep working.
- `ErrorPage` is the last resort when a layout itself fails. Both offer reload (fixes stale chunks
  after a deploy).
- Unknown URLs show the 404 inside the panel that matched.

## Decisions

Each choice below is what large production React apps use today, picked even where a simpler
option existed.

| Area            | Choice                                                                            | Why                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Build           | **Vite**                                                                          | Standard for client-rendered React. Fast dev server, Rolldown production build                                                              |
| Language        | **TypeScript, strict** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | Catches errors at compile time; required for a team-sized codebase                                                                          |
| UI              | **React 19**                                                                      |                                                                                                                                             |
| Routing         | **React Router (data router)**                                                    | Most widely deployed React router. Lazy routes = per-page code splitting                                                                    |
| Server state    | **TanStack Query**                                                                | Standard for API caching, retries, background refresh, request de-duplication                                                               |
| Styling         | **Tailwind CSS v4 + CSS variables**                                               | Tokens live in CSS variables so theme switching is instant and needs no JS re-render. Tailwind ships only the classes used (~6 KB gzip now) |
| i18n            | **i18next + react-i18next**                                                       | Most used React i18n stack. Typed keys, lazy-loaded languages, plurals, interpolation                                                       |
| Dates/numbers   | **Intl API**                                                                      | Built into the browser: Jalali calendar and Persian digits at 0 KB (no moment/dayjs)                                                        |
| Fonts           | **Self-hosted via @fontsource**                                                   | Google Fonts is slow or blocked in Iran. Split by `unicode-range`, so only the scripts on screen download                                   |
| Icons           | **Inline SVG components**                                                         | No icon font, no extra request, only the icons used are bundled                                                                             |
| API mocking     | **MSW**                                                                           | Frontend work and tests don't wait for the backend                                                                                          |
| Tests           | **Vitest + Testing Library**                                                      | Same config as Vite. Add Playwright for end-to-end tests once real flows exist                                                              |
| Lint/format     | **ESLint (typescript-eslint strict-type-checked) + Prettier**                     | Includes `i18next/no-literal-string`, which enforces "all text in dictionaries"                                                             |
| PWA             | **vite-plugin-pwa (Workbox)**                                                     | Manifest ships now; service worker turns on with one flag (see PWA.md)                                                                      |
| Package manager | **pnpm** (pinned via `packageManager`)                                            | Strict dependency resolution, fast CI                                                                                                       |
| Deploy          | **Docker image (nginx) → ghcr.io**, same Swarm as the main site                   | Pre-gzipped assets, `immutable` caching for hashed files, `no-cache` for `index.html`                                                       |

## Theming

- `src/styles/tokens.css` defines every color for `[data-theme='light']` and `[data-theme='dark']`.
- `index.css` maps tokens to Tailwind (`bg-surface`, `text-primary-text`, `shadow-panel`, …).
- The user picks `system | light | dark` (Settings). The choice is stored in `localStorage`, and a tiny
  script in `index.html` applies it **before first paint**, so the page never flashes the wrong theme.
- `dark:` variants follow `data-theme`, not the OS setting directly.

## i18n

- Dictionaries: `src/locales/<lang>/<namespace>.json`. Persian (`fa`) is the source; `t()` keys are
  type-checked against it. `pnpm i18n:check` (CI) fails if another language misses a key or has
  different `{{placeholders}}`.
- `fa` ships in the main bundle. Other languages load as separate chunks on first use.
- Changing language sets `<html lang dir>`, stores the choice, and sets Django's `django_language`
  cookie so the backend answers in the same language. API requests send `Accept-Language`.
- Adding a language: add it to `LOCALES` in `src/lib/i18n/config.ts`, add
  `src/locales/<lang>/*.json`, and update the pre-paint script in `index.html` if it is LTR/RTL.
- Adding a namespace (for a large feature): add it to `NAMESPACES`, create the JSON in every language,
  and add it to the `CustomTypeOptions` resources in `src/lib/i18n/i18next.d.ts`.

## Performance budget

Current first load (gzip): JS ≈ 131 KB (react 68, other libraries 55, app 7), CSS ≈ 6 KB, fonts
are loaded per script as text appears.

- Libraries and app code are in separate chunks (`vite.config.ts` → `codeSplitting`), so a deploy only
  invalidates the small app chunk in users' browsers.
- `index.html` preloads the `whoami` request, so the session check runs while JS downloads.
- New pages must be lazy routes. Heavy widgets (charts, editors, date pickers) are lazy-loaded inside
  their page.
- The Noto Kufi display font costs ~120 KB. Set `--family-display` to `var(--family-body)` in
  `tokens.css` to drop it if needed.
