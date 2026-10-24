# Architecture

## Folder layout

```
src/
├── main.tsx               Entry: i18n, global CSS, optional API mocks, render <App>
├── app/                   Assembles everything (top layer)
│   ├── App.tsx            Providers: React Query, theme, router, PWA update prompt
│   ├── router.tsx         Route map: /login, /start, shared pages, one tree per panel
│   ├── ErrorPage.tsx      Layout-level error page, in-panel SectionError, 404
│   ├── ChoosePanelPage    /choose: which panel to start in (several panels)
│   └── layouts/
│       ├── AuthLayout     Pages outside panels (login, sign-up, reset; later terms, inactive):
│       │                  form beside the trust wall (TrustWall, trustContent.ts)
│       ├── PanelLayout    Frame shared by every panel: header + panel menu, account menu, tabs
│       ├── PanelFooter    Small footer: language + theme switches, copyright (bottom of screen on
│       │                  short pages, after the content on long ones; hidden on phones in PageFill)
│       ├── PanelSwitcher  "Panel X ▾" beside the logo (several panels only), PanelTile
│       ├── AccountMenu    Who is logged in, settings, logout
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
├── components/            Shared UI; components/ui/ = design-system primitives,
│                          components/tickets/ = conversation blocks (any panel),
│                          components/applicant/ = applicant-panel pieces several pages share and
│                          that talk to the API (SectionLock, CallRequestButton; canvas V7)
├── lib/                   Infrastructure (bottom layer)
│   ├── api/               fetch client (session cookie + CSRF), React Query client
│   ├── applicant/         Shared by applicant pages: query-key prefix, approve/reject an application,
│   │                      the tickets endpoint (tickets page + home card), access
│   │                      (which sections are locked) and the call request
│   ├── tickets/           Panel-neutral ticket API: types, queries, send/rate/seen hooks, day grouping
│   ├── dates.ts           Whole days until / between dates
│   ├── auth/              session (whoami), roles (same rules as Django), logout
│   ├── i18n/              i18next setup, locales config, Intl formatters (Jalali dates)
│   ├── router/            lazyPage(): page chunk + its dictionaries in parallel
│   ├── site.ts            Links to main-site pages and the support phone
│   └── theme/             Light / dark / system theme
├── locales/<lang>/        Dictionaries: common.json + one per feature namespace. fa is the source
├── styles/                tokens.css (design tokens), index.css (Tailwind + base)
├── mocks/                 MSW fake Django for `pnpm dev:mock` and tests (handlers.ts: auth;
│                          applicant.ts: applicant-panel API; session.ts: who is logged in)
├── pwa/                   Service-worker registration + update prompt
└── test/                  Vitest setup, MSW server, renderApp() (vitest.node-globals.ts: Node's FormData/File)
```

### Layers

`lib` + `components` ← `features` ← `panels` ← `app`. A layer imports only from layers to its
left, and a feature never imports another feature (shared code moves to `lib` or `components`).
ESLint (`no-restricted-imports` in `eslint.config.js`) enforces this; tests are exempt.

### Shared blocks (`components/ui/`)

Pages are put together from shared blocks, so a section looks and behaves the same everywhere and
a change is made once. A feature keeps only what is specific to it (its data, its wording, its
rules); anything that looks the same on two pages becomes a block. Blocks take ready-made text and
numbers as props (no fetching, no dictionary of their own), so any panel can use them.

| Block                                                         | Use it for                                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `PageStack`, `PageColumns`                                    | Page body: header + sections; main column with a side `<aside>` that drops under it on phones                             |
| `PageHeader`                                                  | The page's h1, subtitle and actions (sets the document title)                                                             |
| `SectionCard` (`list` / `panel`), `SectionHeading`, `Badge`   | A titled card (a region named by its h2); a section title above several cards or a toolbar                                |
| `EmptyState` (`inset` / `padded` / `card`), `SkeletonRows`    | "Nothing here yet" with a next step; loading rows                                                                         |
| `ProgressBar`, `StepBar`, `StepList`, `StepDot`               | Progress and steps (case stages, visa, writing, form sections); `onHero` tone for the dark card                           |
| `StatGrid`                                                    | A row of number tiles                                                                                                     |
| `FilterTabs`, `SearchField`, `Pager`                          | List toolbars and paging                                                                                                  |
| `FileDrop`, `PickedFile`, `FileTile`                          | Choosing, holding and showing files (checks in `lib/files.ts`); `FileDrop inputLabel` names a short "Upload" button fully |
| `TagList`, `Chip`, `Avatar`, `StarRating`                     | Tags with optional remove, status pills, initials, 1–5 rating                                                             |
| `Button`, `IconButton`, `IconLink`, `buttonClass`, `tabClass` | Actions (44px touch targets; icon-only ones require `aria-label`)                                                         |
| `Notice`, `InlineConfirm`, `TextField`, `Icon`, `Card`        | Messages, in-place confirmation, inputs, icons, a bare card                                                               |
| `BackLink`                                                    | "← Back" above a sub-page's title (writing forms, payment)                                                                |
| `LockBanner`, `PreviewChip`, `PreviewArea` (`Lock.tsx`)       | A section the user can't use yet: why (4 tones), "sample data" label, the faded `inert` sample under it                   |
| `LinkTile`, `TileGrid`                                        | A card that is one link (title, line, optional end mark and footer), in a 1–2–4 column grid                               |
| `OtpInput`                                                    | An SMS code as boxes over one real input (paste, autofill, screen readers); `length` digits. Login and the Turkey pledge  |

Conversation blocks (`components/tickets/`), same rules (text as props, no fetching), for every
panel that shows tickets:

| Block                                            | Use it for                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MessageThread`, `MessageBubble`, `DaySeparator` | A conversation in its own scroll box, kept at the newest message ("show earlier" keeps the reader's place); own vs other side, tag, file, seen, a footer slot |
| `Composer`                                       | Writing a message: text, priority radios, a must-accept box, attach (`FileDrop compact`), send                                                                |
| `ThreadHeader`                                   | Top of a conversation card: stacked avatars, title, subtitle                                                                                                  |
| `ThreadSwitch`, `ThreadTabs`                     | Links between conversations: segmented (departments), pills (writing departments)                                                                             |
| `FaqList`                                        | Questions that open to their answer (`<details>`)                                                                                                             |
| `TicketRating`                                   | Stars under a staff reply, then the given score (`StarRating`, `StarScore`)                                                                                   |

Block extensions made for them: `Avatar stacked`, `FileDrop compact` (icon only on phones),
`StarScore`, `Icon filled`, the `clock`, `help` and `send` icons. For chat-like pages: `PageFill`
(fills the screen between header and bottom tabs on phones, using `--panel-top` / `--panel-bottom`
from PanelLayout), `PageColumns fill` (side column hidden on phones), `PageHeader compact` (no
subtitle on phones) and `SheetButton` (`components/ui/Sheet.tsx`: a round button that opens a bottom
sheet, for side-column content on phones).

### Tickets across panels

`lib/tickets` (API and hooks, given an endpoint and a query-key prefix) ← `components/tickets`
(blocks) ← `features/tickets` (the page: a chat screen on phones with the composer above the bottom
tabs and the FAQ in a sheet; `tickets` dictionary, `TicketsConfig`: endpoint, page
path, `viewer: applicant | staff`) ← `panels/<panel>/` (passes its config; the applicant panel's is
`panels/applicant/tickets.ts`). Writing tickets are threads of the same page, not a copy. The
supervisor and writer panels add their own endpoint (one applicant's threads) and `viewer: 'staff'`.

Helpers used with them: `lib/progress.ts` (`percentOf`, `stepState`), `lib/files.ts` (`checkFile`,
`extensionOf`), `lib/text.ts` (Persian digits, phone numbers, initials).

**See and tweak them:** `pnpm dev:mock`, then open `/panel/dev/components`: every block with sample
data, with light/dark and fa/en (RTL/LTR) switches. The page exists only in dev builds.

When a new screen needs something a block can't do, extend the block (a prop or a variant) rather
than copying its markup into the feature, and add it to the gallery.

### Locked sections (applicant panel, canvas V7)

Every account has the applicant panel. `GET /applicant/v1/access/` (`lib/applicant/access.ts`) says
whether the user has an active contract, one in review, none, or an ended one, and its services.
`lockOf(access, section)` turns that into a lock per section; the panel's `useLockedNav` marks
locked items in the menus. A locked page renders `SectionLock` (`components/applicant/`): the
banner for the reason, and under it the page's own blocks fed with sample data from the feature's
`preview.ts` (texts from its dictionary), faded and `inert`. An ended contract shows the real case
under the banner. Dev: `localStorage['scorize.mock.access']` = `pending` / `noservice` / `ended`
switches the mock user's state (log in as Maryam for a guest).

### Panels and roles

- `lib/auth/roles.ts` turns `whoami` into roles with the same rules as the Django site
  (`is_seller`, `is_executer`, `can_write_*`, …). Several roles at once are normal.
- `panels/registry.ts` lists every panel. A user sees the panels their roles allow.
- Each panel route has a loader: no session → login; no role → `/start`. The API still checks
  every request; this only keeps people out of UI they can't use.
- The applicant panel is listed for everyone without a work panel, plus staff with an applicant
  file of their own (needs R1 in whoami; until then staff see only their work panels). Anyone may
  still open it as a regular customer: a quiet link on the chooser and in the account menu.
- One panel: no switcher, `/start` goes straight to it. Several: the dark "Panel X ▾" switcher
  beside the logo (`PanelSwitcher`: dropdown on desktop, bottom sheet on phones) lists them and
  sets where to land after login: last used (default), always one panel, or always ask.
- `/start` sends a user with several panels to the pinned panel, else the last used one; with no
  last panel yet (first login on this device) or "always ask", to `/choose` (`ChoosePanelPage`).
  Each card there opens its panel.
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
- Something that is light in both themes (the paper admission letters on the login page) sets
  `data-theme="light"` on itself, so the tokens inside resolve to their light values.
- The wordmark (`components/ui/Logo`) is the main site's: Arial Black, "rize" in the primary colour.
  It uses the installed Arial Black, else the font file Django already serves under `/static/`.

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
  add it to the `CustomTypeOptions` resources in `src/lib/i18n/i18next.d.ts`, and pass it to the page's
  `lazyPage(…, ['<namespace>'])`. Then delete `node_modules/.vitest-cache`: Vitest's module cache keeps
  the old `import.meta.glob` file list, so tests would not see the new dictionary.

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
