# Assessment authoring extension

Continues stage three after panel #98 and backend #303/#304. The extension remains
at `/panel/dev/assessments`, omitted from production builds. Django independently
requires local mode, the opt-in assessment flag and the action's staff permission.

## Editor workflow

- Create a question or route with a stable Latin identity. Question types: number,
  boolean or choice. Set numeric bounds or choice options, optional English text,
  guidance, response cost and conditional visibility. Backend validation blocks
  invalid references, cycles, impossible rules and excessive validation complexity.
- Inspect each question's direct and indirect route uses. Remove references before
  deleting or changing its type. Removing a route also removes source/scenario
  references; historical approved versions are unaffected.
- Add/remove mandatory conditions, score criteria, bands and reference scenarios.
  Expected outcomes are supplied independently. Adding a route starts its expected
  outcome as unknown: the editor must choose an independently justified expectation
  and explicitly include the route in source coverage before testing/review.
- Save before testing. Reports retain actual/expected/previous results. Incompatible
  old answer domains are explained and left unknown in the baseline, not coerced.
- A separate reviewer can approve or return content with a required explanation.
  The return note appears in the audit history. Returned content needs new tests.
- A publisher can activate now, revoke, schedule a future activation or cancel it.
  Device-local date/time is converted to an ISO instant. The local scheduler must
  run: use a shared local Celery broker with beat/worker, or the backend management
  command `process_assessment_releases` from a local scheduler. The default
  `memory://` broker cannot communicate between separate processes.

The health panel reports real content/test/source states; it links to affected
drafts. Counts cover all versions, while the issue list is capped at 50. Content
comparison shows actual changed fields against the active version, separately
from the reference scenario report. It does not claim applicant impact numbers.

## API changes

`GET /api/staff/v1/assessments/health/` is prefetched in the route alongside the
draft list and template/options. Draft details add `comparison` and `scheduled_at`.
New revision-checked actions are `reject` (`note`), `schedule` (`publish_at`) and
`cancel_schedule`. Audit events may include `detail.note`. Validation reports may
include `before_incompatible_answers`. Matching MSW handlers remain tests only.

Unsaved input is retained on conflicts, and workflow actions stay disabled until
saved. Approved definitions are read-only. English/Persian strings use the existing
namespace, shared components and RTL-safe layout. Content and health load through
React Query; detail remains intentionally behind draft selection.

Backend deployment must precede this client. The backend adds three nullable
scheduling fields; its real migration history must be followed. Keep production
gates off; this is a local synthetic content workspace, not a live immigration
service. Reviewed country calculators, financial policy, applicant flow and real
question/product analytics remain subsequent milestones.

## Validation

- Full panel run: **634 tests / 84 files passed**. The authoring/helper checks
  were also run on the final code: **10 tests / 2 files passed** (the helper file
  was added after the full run started).
- Lint, TypeScript, locale parity, production build and size checks pass. Initial
  assets: JS **178.7 KB**, CSS **20.5 KB** gzip, within the existing budgets.
- Assessment OpenAPI: 17 paths validate. Backend stack: 80 focused tests pass;
  full API has 1581 passes and three failures reproduced on the unchanged base.
- Real Chromium against Django/Vite used separate editor/reviewer/publisher
  accounts to author a numeric question and new route, edit its rule and reference
  expectation, cover all routes with a source, save/test/submit, return with a note,
  re-test, independently approve, schedule/cancel and activate. Approved fields were
  disabled. Persian RTL at 390px showed no horizontal document overflow or page
  JavaScript errors. This was a local synthetic flow, with no production data.
