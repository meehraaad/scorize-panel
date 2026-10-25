# Scorize Panel — project map (for any AI assistant)

Vite + React 19 + TypeScript SPA for Scorize's logged-in panels (applicant panel first), served at
`/panel/` on the main site's domain. The backend is the separate `scorize` Django repo
(`~/scorize`); this repo only calls its REST API under `/api/`, authenticated with the Django session cookie.

Design source: the "Scorize Dashboard Redesign" canvas (claude.ai artifact JEXyTSQ8XukDdVB2zphw28),
versions V6/V7 for the applicant panel.

## Read first

- `docs/architecture.md`: folder layout, every tech decision, theming, i18n, performance budget
- `docs/backend-integration.md`: how the panel talks to Django today (auth flow, endpoints)
- `docs/backend-changes.md`: every change the redesign needs in Django. **Do not edit or connect anything
  in the scorize repo** until the migration: the old site must keep working as it is. Add needed backend
  changes to this list instead

## Hard rules

- **No literal UI text.** Every string goes in `src/locales/fa/*.json` (source) and every other
  language, used via `t('key')`. ESLint (`i18next/no-literal-string`) and `pnpm i18n:check` enforce it.
- **No raw colors.** Use token classes (`bg-surface`, `text-text-2`, `bg-primary`, …) from
  `src/styles/tokens.css`. A new token needs both light and dark values.
- **RTL-safe layout.** Use logical utilities (`ps-*`, `me-*`, `start-*`, `text-start`), never `left`/`right`.
- **Panels**: navigation and routes live in `src/panels/<panel>/`; layouts in `src/app/layouts/`.
  Every page is lazy (`lazyPage`). Layers are enforced by ESLint (see docs/architecture.md).
- **API calls** go through `api()` in `src/lib/api/client.ts` and React Query, straight to Django's
  endpoints (table in docs/backend-integration.md; schema at `/api/schema/`): the app has no mock
  mode and no sample data. `src/mocks/` is the fake Django the **tests** run against: mirror each
  new endpoint there with the shape Django sends. A feature whose endpoint hasn't shipped stays off
  in `src/lib/applicant/onServer.ts`.
- **Build pages from shared blocks** (`src/components/ui/`, listed in docs/architecture.md, previewed
  at `/dev/components` in dev). Don't copy a block's markup into a feature: extend the block instead.
- Accessible markup: real `<button>`/`<a>`, `aria-label` on icon-only buttons, touch targets ≥ 44px.
- **Messages**: what an action did goes in a toast (`toast.success/error` from `src/lib/toast.ts`;
  uploads through `uploadFile`/`uploadWithToast` in `src/lib/upload.ts`). `<Notice>` is only for what
  must be fixed on the page first or describes the page (docs/architecture.md, "Messages").
- **Links from API data** go through `safeHref()` (`src/lib/url.ts`). The CSP (`security-headers.conf`)
  allows no inline scripts except the hashed boot script in `index.html`.

## Commands

`pnpm dev` (proxy to Django on :8000) · `pnpm lint` · `pnpm typecheck` ·
`pnpm test` · `pnpm i18n:check` · `pnpm build`. Run lint, typecheck, test and i18n:check before finishing a change.
