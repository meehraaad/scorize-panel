# Local assessment content workspace

Development URL: `/panel/dev/assessments`. The route is omitted from production
builds and has no production navigation entry. It requires a logged-in staff
account; Django checks every read/write permission. The application always calls
the backend. MSW fixtures under `src/mocks/` are for tests only.

Backend dependency: `shamrad/lang` assessment core PR #303 plus the subsequent
content-management milestone, branch `codex/assessment-management`. See the
backend's `docs/assessment-content-management.md` for the full contract,
permissions, migration policy, lifecycle and remaining work.

Start local Django with `SCORIZE_LOCAL=1 SCORIZE_ADAPTIVE_ASSESSMENT=1`, then
`pnpm dev`. Open the development URL. Create or copy a draft, edit its existing
question/rule/score definitions, add source review dates, and supply independent
scenario expectations. Save before testing/submitting. Reports compare expected,
actual and previous active results. A separate reviewer approves; a publisher
activates/revokes synthetic versions only. Approved content is read-only.

All requests use `/api/staff/v1/assessments/` (`options`, `drafts`, draft detail,
`test`, `submit`, `approve`, `publish`, `revoke`). Initial list/options queries
start in the route loader; detail loads after selection. Loading shows shared
skeletons. A revision conflict retains unsaved form values. No raw JSON editor
is required for the supported rule types. Persian/English text uses the
`assessments` namespace.

This is the first management workspace, not the entire stage-three product.
Arbitrary question/route creation, detailed question analytics, scheduled
publication, reviewer comments/rejection and production routing remain pending.
Editable budget ranges and financial policies remain phase six of the updated
plan; existing budget choices and historical sales records are untouched.

## Validation

- Full final panel suite: **631 tests / 84 files passed**. Assessment and page-data
  checks also passed together (80 tests), including a cold-cache StrictMode case.
- Typecheck, lint, Persian/English locale parity and production build pass.
  Initial assets stay within budget: JS 178.8 KB and CSS 20.5 KB gzip. The
  production JavaScript contains no `dev/assessments` route.
- Chromium against real local Django/Vite exercised save, validation, submission,
  independent approval, explicit source coverage and activation/revocation.
  Approved fields locked, no page JavaScript errors occurred, and a 390px mobile
  viewport had no document overflow. The comparison table scrolls within itself.
- Existing ticket-composer integration coverage now awaits the asynchronous
  success reset before asserting the cleared form. No ticket application logic
  was changed. The translation transform cache was regenerated after rebasing
  the workspace onto current main, including its new notes namespace.

Dependency/review order: backend core **shamrad/lang#303**, content management
**shamrad/lang#304**, then companion panel **meehraaad/scorize-panel#98**. The
backend has five reproducible failures on its unchanged base (time-of-day task
assumptions and Nginx configuration assertions), documented in its PR. Neither
repository has been merged or deployed by this work.
