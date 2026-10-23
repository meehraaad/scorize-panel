# Scorize Panel — project map (for any AI assistant)

Vite + React 19 + TypeScript SPA for Scorize's logged-in panels (applicant panel first), served at
`/panel/` on the main site's domain. The backend is the separate `scorize` Django repo
(`~/scorize`); this repo only calls its REST API under `/api/`, authenticated with the Django session cookie.

Design source: the "Scorize Dashboard Redesign" canvas (claude.ai artifact JEXyTSQ8XukDdVB2zphw28),
versions V6/V7 for the applicant panel.

## Read first

- `docs/architecture.md`: folder layout, every tech decision, theming, i18n, performance budget
- `docs/backend-integration.md`: how the panel talks to Django today (auth flow, endpoints)
- `docs/backend-changes.md`: every change the redesign needs in Django. **Do not edit the scorize repo**;
  add needed backend changes to this list instead

## Hard rules

- **No literal UI text.** Every string goes in `src/locales/fa/*.json` (source) and every other
  language, used via `t('key')`. ESLint (`i18next/no-literal-string`) and `pnpm i18n:check` enforce it.
- **No raw colors.** Use token classes (`bg-surface`, `text-text-2`, `bg-primary`, …) from
  `src/styles/tokens.css`. A new token needs both light and dark values.
- **RTL-safe layout.** Use logical utilities (`ps-*`, `me-*`, `start-*`, `text-start`), never `left`/`right`.
- **Panels**: navigation and routes live in `src/panels/<panel>/`; layouts in `src/app/layouts/`.
  Every page is lazy (`lazyPage`). Layers are enforced by ESLint (see docs/architecture.md).
- **API calls** go through `api()` in `src/lib/api/client.ts` and React Query. Mirror each new
  endpoint in `src/mocks/handlers.ts`.
- Accessible markup: real `<button>`/`<a>`, `aria-label` on icon-only buttons, touch targets ≥ 44px.

## Commands

`pnpm dev:mock` (no backend) · `pnpm dev` (proxy to Django on :8000) · `pnpm lint` · `pnpm typecheck` ·
`pnpm test` · `pnpm i18n:check` · `pnpm build`. Run lint, typecheck, test and i18n:check before finishing a change.
