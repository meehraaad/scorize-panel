# Architecture

## Folder layout

```
src/
├── main.tsx               Entry: i18n, global CSS, render <App>
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
│                          export), components/, api.ts (or api/ with one file per page and
│                          an index.ts once it passes ~400 lines), hooks. Used by panels.
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
│   ├── sales/             Shared by sales pages: lead stages, sources, lost reasons, score bands,
│   │                      message links (WhatsApp/Telegram/SMS), receipt confirmation
│   ├── tasks/             Panel-neutral staff tasks (StaffToDo): my follow-up / request / team queue;
│   │                      django.ts runs the sales panel's tasks on Django's existing todos/ API
│   ├── staff/             Django's existing staff REST API (/api/profile/staff/v1/): serializer
│   │                      types, pagination, the logged-in staff id (backend-integration.md)
│   ├── dates.ts           Whole days until / between dates
│   ├── applications.ts    An application's result, approval and fee names (applicant + supervisor pages)
│   ├── account/           Every panel's account: notifications (the header's bell), channels, login details
│   ├── auth/              session (whoami), roles (same rules as Django), logout
│   ├── i18n/              i18next setup, locales config, Intl formatters (Jalali dates)
│   ├── router/            lazyPage(): page chunk + its dictionaries in parallel
│   ├── site.ts            Links to main-site pages and the support phone
│   └── theme/             Light / dark / system theme
├── locales/<lang>/        Dictionaries: common.json + one per feature namespace. fa is the source
├── styles/                tokens.css (design tokens), index.css (Tailwind + base)
├── mocks/                 MSW fake Django for the tests only (handlers.ts: auth; applicant.ts:
│                          applicant-panel API; staff.ts: Django's staff API rows, from which
│                          salesStaff.ts + legacy/ compute the sales endpoints; session.ts: who is logged in)
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

| Block                                                         | Use it for                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageStack`, `PageColumns`                                    | Page body: header + sections; main column with a side `<aside>` that drops under it on phones                                                                                                                       |
| `PageHeader`                                                  | The page's h1, subtitle and actions (sets the document title)                                                                                                                                                       |
| `SectionCard` (`list` / `panel`), `SectionHeading`, `Badge`   | A titled card (a region named by its h2); a section title above several cards or a toolbar                                                                                                                          |
| `EmptyState` (`inset` / `padded` / `card`), `SkeletonRows`    | "Nothing here yet" with a next step; loading rows                                                                                                                                                                   |
| `ProgressBar`, `StepBar`, `StepList`, `StepDot`               | Progress and steps (case stages, visa, writing, form sections); `onHero` tone for the dark card                                                                                                                     |
| `StatGrid`                                                    | A row of number tiles                                                                                                                                                                                               |
| `FilterTabs`, `SearchField`, `Pager`                          | List toolbars and paging                                                                                                                                                                                            |
| `FileDrop`, `PickedFile`, `FileTile`                          | Choosing, holding and showing files (checks in `lib/files.ts`); `FileDrop inputLabel` names a short "Upload" button fully                                                                                           |
| `TagList`, `Chip`, `Avatar`, `StarRating`                     | Tags with optional remove, status pills, initials, 1–5 rating                                                                                                                                                       |
| `Button`, `IconButton`, `IconLink`, `buttonClass`, `tabClass` | Actions (44px touch targets; icon-only ones require `aria-label`)                                                                                                                                                   |
| `Notice`, `InlineConfirm`, `TextField`, `Icon`, `Card`        | Messages (`error`, `info`, `success`, `warn`: something to fix first), in-place confirmation, inputs (one line, several lines), icons, a bare card                                                                  |
| `BackLink`                                                    | "← Back" above a sub-page's title (writing forms, payment)                                                                                                                                                          |
| `LockBanner`, `PreviewChip`, `PreviewArea` (`Lock.tsx`)       | A section the user can't use yet: why (4 tones), "sample data" label, the faded `inert` sample under it                                                                                                             |
| `LinkTile`, `TileGrid`                                        | A card that is one link (title, line, optional end mark and footer), in a 1–2–4 column grid (`dense`: 2 on phones)                                                                                                  |
| `ChoiceGroup`, `TogglePill`, `SelectField`, `TextAreaField`   | One-of-a-few radios as pills or tiles, a checkbox pill, labelled select (or `inline` in a toolbar), multi-line field                                                                                                |
| `DatePicker`                                                  | A date (or date and time) in the user's calendar: Jalali in Persian, Gregorian in English (`lib/calendar.ts`), with month/year views, keyboard use, `only="future"/"past"`. Use it instead of `<input type="date">` |
| `Dialog`                                                      | A modal form: bottom sheet on phones, side panel from lg (log a call, add a lead). Parent controls `open`                                                                                                           |
| `OtpInput`                                                    | An SMS code as boxes over one real input (paste, autofill, screen readers); `length` digits. Login and the Turkey pledge                                                                                            |
| `Switch`                                                      | An on/off setting row: a real checkbox with `role="switch"`, label and a line under it                                                                                                                              |
| `DateTile`                                                    | A small calendar leaf (day over month; `large` adds the weekday): consultations, the writer's week. Decorative: say the date in text beside it                                                                      |
| `Toast`, `Toaster`                                            | What an action did (saved, not sent, upload progress). Not used directly: call `toast.*` / `uploadWithToast` (see Messages below); `Toaster` is mounted once in `App`                                               |

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

### Messages: toast or Notice

Design: canvas "Scorize Seller Panel", row 11 (اعلان بارگذاری).

- **Toast** (`lib/toast.ts`): the result of an action. `toast.success(t('saved'))` in a mutation's
  `onSuccess`, `toast.error(t('error'))` in its `onError` (pass them to `mutate`, where the
  component's `t` is). Success and info close after 5 s (held while hovered or focused); errors and
  warnings stay until closed and may carry one `action` ("Send again"). At most 3 at once.
  `<Toaster>` (`components/ui/Toast.tsx`, mounted in `App`) shows them at the bottom, end side from
  lg, full width above the tab bar on phones, and inside an open modal `Dialog` (everything outside
  it is inert) above its buttons.
- **Uploads** (`lib/upload.ts`): `uploadFile(path, formData, file, messages)` for one file,
  `uploadWithToast(jobs, messages)` for several (one toast, a file list, one request each). The
  toast shows progress (a ring), "offline: picks up when you're back" (waits `OFFLINE_WAIT_MS`),
  then success, or an error whose "Send again" runs `messages.retry` (the caller's mutation again).
  It is the only message an upload needs. Requests go through `uploadApi` (XMLHttpRequest, for
  progress; tests swap in a fetch-backed stand-in, `src/test/xhr.ts`).
- **Notice** stays for what belongs on the page, not to an action: a field or form that needs
  fixing first ("choose a file", "wrong password", missing answers), the state of the page (read-only,
  past consultation, declined payment) and completion screens that replace a form (thanks).
  Field errors stay on their field (`TextField error`).
- Tests read toasts with `toasts()` from `src/test/toasts.ts`.

### Tickets across panels

`lib/tickets` (API and hooks, given an endpoint and a query-key prefix) ← `components/tickets`
(blocks) ← `features/tickets` (the page: a chat screen on phones with the composer above the bottom
tabs and the FAQ in a sheet; `tickets` dictionary, `TicketsConfig`: endpoint, page
path, `viewer: applicant | staff`) ← `panels/<panel>/` (passes its config; the applicant panel's is
`panels/applicant/tickets.ts`). Writing tickets are threads of the same page, not a copy. The
supervisor panel passes one applicant's threads with `viewer: 'staff'` and `embedded` (inside the
case file: no page header, no full-screen chat; `panels/supervisor/CaseTicketsPage.tsx`). Staff pick no
priority, see the applicant's rating under staff replies, no FAQ or opening hours, and their own
thread subtitle and empty state. The writer panel does the same for one order's conversation
(`panels/writer/OrderTicketsPage.tsx`, endpoint `writer/v1/orders/<id>/tickets`).

### Writing forms

`features/writing` builds every applicant writing form from a spec (`sopForm`, `cvForm`,
`recommendationForm`, `plForm`; see `formSpec.ts`): field kinds include `checks` (several options),
`tags` (typed labels), `term` (the next intakes), `url`, and `when` (asked only for some answers).
Shared parts: `FormHeader` (title, autosave status, tabs of the contract's forms), `FinalBar` and
`useFinal` (final submit that points at missing answers), `FormAside` (tips, phone, ticket card per
spec). The recommendation form lays its list out as one card per recommender
(`RecommendationFormPage`, passed to `WritingFormPage` as `View`).

Helpers used with them: `lib/progress.ts` (`percentOf`, `stepState`), `lib/files.ts` (`checkFile`,
`extensionOf`), `lib/text.ts` (Persian digits, phone numbers, initials).

**See and tweak them:** `pnpm dev`, then open `/panel/dev/components`: every block with sample
data, with light/dark and fa/en (RTL/LTR) switches. The page exists only in dev builds.

When a new screen needs something a block can't do, extend the block (a prop or a variant) rather
than copying its markup into the feature, and add it to the gallery.

### Sales panel (canvas "Scorize Seller Panel")

`features/sales/` holds every sales page (Today, Leads and My consultations under one nav tab with
`LeadsLayout`'s sub-tabs, Board, My month, the customer
pages: `CustomerLayout` with its sub-tabs summary / purchases / payments / details / application file,
the offer page; later the manager pages), `api/` with one response per page (a file per page
or tab, re-exported by `api/index.ts`), and
`paths.ts` (the panel's URLs, since features can't import panels). Shared vocabulary (stages, sources,
scores) is in `lib/sales/`; tasks in `lib/tasks/` (the supervisor panel uses them too). "Call" buttons
open the customer page with `?log=call`, so every call ends in the log dialog; `?log=meeting&reservation=`
logs a consultation session; `?sell=<category>` opens the product sale. Mock seller: Nima (09120000002); sales manager: Reza (09120000003). The manager section
(`features/sales/manager/`) is a nav item with `permission: 'can_assign_to_seller'`: `NavItem.permission`
hides it from others and the route's loader sends them back. Backend items: backend-changes.md S, T.

`features/tasks/` is the panel-neutral "Today's tasks" page (my follow-ups, requests to me, team
queue), configured per panel with `TasksConfig` (`panels/sales/TasksPage.tsx`), like tickets. Its API
and the "new task" hook are in `lib/tasks/`: the sales panel's tasks run on Django's existing
StaffToDo API (`lib/tasks/django.ts`), the supervisor panel's on the planned endpoint.

Connected pages: the customer page and its history, purchases, payments and details tabs, the
leads list, "my consultations" and tasks read and write Django's existing staff API
(`lib/staff/api.ts`) through adapters in each page's `queryFn`; what that API can't hold yet is
hidden (`LeadsData.supports`, `CustomerData.supports`) rather than sent nowhere. The table is in
backend-integration.md "Existing staff API".

### Supervisor panel (canvas V1 supervisor screens and V5 "today", in the V6 look)

`features/supervisor/` holds every supervisor page: Today (`TodayPage`: the dark deadline board for
the next 14 days, the cases waiting on the supervisor, links by stage), All files (`CasesPage`: by
stage, search, email-bot filter, selection → export of applications as CSV) and the case file
(`CaseLayout`: dark summary card, the email bot's problems with links to fix them, tabs, the stage
dialog) with its tabs: overview (progress, contract, instalments, open tasks + new task, latest
activity), documents (accept an upload or send it back with a reason, request a document, writing
orders, research interests), email and applications (bot on/off, applications with the side editor
`ApplicationDialog`, professor emails, login details), tickets (the shared page, see above) and
activity. `InboxPage` lists every case's supervisors' thread, waiting ones first. `api/` has one
response per screen (a file per screen, keys and stages in `api/common.ts`); `paths.ts` the panel's URLs. "My tasks" is the shared tasks page with
`panel: 'supervisor'` (`panels/supervisor/TasksPage.tsx`). Reports has no design yet. Mock: Maryam
(09120000001) in the tests, `src/mocks/supervisor.ts` (her tasks in `src/mocks/tasks.ts`). Backend items:
backend-changes.md SV.

### Locked sections (applicant panel, canvas V7)

Every account has the applicant panel. `GET /applicant/v1/access/` (`lib/applicant/access.ts`) says
whether the user has an active contract, one in review, none, or an ended one, and its services.
`lockOf(access, section)` turns that into a lock per section; the panel's `useLockedNav` marks
locked items in the menus. A locked page renders `SectionLock` (`components/applicant/`): the
banner for the reason, and under it the page's own blocks fed with sample data from the feature's
`preview.ts` (texts from its dictionary), faded and `inert`. An ended contract shows the real case
under the banner. Tests: `localStorage['scorize.mock.access']` = `pending` / `noservice` / `ended`
switches the fake user's state (Maryam is a guest).

### Gates (applicant panel, canvas V6 sections 8 and 14)

`GET /applicant/v1/gates/` (`lib/applicant/gates.ts`) says what must happen before the panel
opens. The applicant routes sit under a pathless layout, `features/gates/GatesLayout`, which shows
the first gate that applies instead of the page: a closed (inactive) panel, the terms, the missing
profile details, then the month's supervisor surveys. Answering one invalidates the applicant
queries and the next gate (or the page asked for) appears. The optional NPS survey is a card on the
home page (`components/applicant/NpsCard`). Tests: `localStorage['scorize.mock.gate']` = `terms` /
`surveys` / `inactive` / `nps` (as Sara).

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

### Security

- Auth is the Django session cookie (HttpOnly); unsafe requests send the CSRF token (`lib/api/`).
- Links and redirects built from API data go through `safeHref` (`lib/url.ts`): only http(s) and
  same-origin paths, so a stored `javascript:` URL never runs. `FileTile` and `IconLink` do it
  themselves; a raw `<a href={…}>` with server data must call it.
- `security-headers.conf` (included in every nginx location) sets the CSP and the other headers.
  The CSP allows only the panel's own files plus the inline boot script of `index.html` by hash:
  editing that script means updating the hash (`src/app/csp.test.ts` fails and prints it). HSTS is
  set where TLS ends (backend-changes.md A8).

## Decisions

Each choice below is what large production React apps use today, picked even where a simpler
option existed.

| Area            | Choice                                                                              | Why                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Build           | **Vite**                                                                            | Standard for client-rendered React. Fast dev server, Rolldown production build                                                              |
| Language        | **TypeScript, strict** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)   | Catches errors at compile time; required for a team-sized codebase                                                                          |
| UI              | **React 19**                                                                        |                                                                                                                                             |
| Routing         | **React Router (data router)**                                                      | Most widely deployed React router. Lazy routes = per-page code splitting                                                                    |
| Server state    | **TanStack Query**                                                                  | Standard for API caching, retries, background refresh, request de-duplication                                                               |
| Styling         | **Tailwind CSS v4 + CSS variables**                                                 | Tokens live in CSS variables so theme switching is instant and needs no JS re-render. Tailwind ships only the classes used (~6 KB gzip now) |
| i18n            | **i18next + react-i18next**                                                         | Most used React i18n stack. Typed keys, lazy-loaded languages, plurals, interpolation                                                       |
| Dates/numbers   | **Intl API**                                                                        | Built into the browser: Jalali calendar and Persian digits at 0 KB (no moment/dayjs)                                                        |
| Fonts           | **Self-hosted via @fontsource**                                                     | Google Fonts is slow or blocked in Iran. Split by `unicode-range`, so only the scripts on screen download                                   |
| Icons           | **Inline SVG components**                                                           | No icon font, no extra request, only the icons used are bundled                                                                             |
| API mocking     | **MSW**                                                                             | Tests only: a fake Django in `src/mocks/`. The app always calls Django (no mock mode)                                                       |
| Tests           | **Vitest + Testing Library**                                                        | Same config as Vite. Add Playwright for end-to-end tests once real flows exist                                                              |
| Lint/format     | **ESLint (typescript-eslint strict-type-checked) + Prettier**                       | Includes `i18next/no-literal-string`, which enforces "all text in dictionaries"                                                             |
| PWA             | **vite-plugin-pwa (Workbox)**                                                       | Manifest ships now; service worker turns on with one flag (see PWA.md)                                                                      |
| Package manager | **pnpm** (pinned via `packageManager`)                                              | Strict dependency resolution, fast CI                                                                                                       |
| Deploy          | **Docker image (non-root nginx, port 8080) → ghcr.io**, same Swarm as the main site | Pre-gzipped assets, `immutable` caching for hashed files, `no-cache` for `index.html`                                                       |

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
- The panel's Suspense boundary is keyed by pathname so a new page shows its loading state during
  navigation instead of leaving the previous screen visible under the new URL. Search-only changes
  keep form state. Customer tabs have a separate boundary so their data cannot block customer actions
  or dialogs.
- The Noto Kufi display font costs ~120 KB. Set `--family-display` to `var(--family-body)` in
  `tokens.css` to drop it if needed.
