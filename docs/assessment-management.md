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
