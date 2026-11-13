# Destination follow-up panel

Draft panel [#108](https://github.com/meehraaad/scorize-panel/pull/108) builds on #107 and requires [backend #323](https://github.com/shamrad/lang/pull/323), on #322. Backend first; no merge, deployment or production activation.

The development-only destination page adds explicit selection of up to six available options, customer ordering, per-action self-reported progress and needs-recheck after a captured basis changes. Historical plans are read-only. This research plan is not an exhaustive legal document checklist, a timeline promise or proof of eligibility. Unsupported programs require specialist identification; current CA/AU dates outside 2026-11-12 coverage require source review.

The API extends the existing destination POST with select_routes and action_progress, retaining revision/hash/UUID and exact retry. Unsaved intake/financial answers and pending requests protect plan operations and links. Removed catalog options remain explicitly unavailable. No new model or migration is needed.

Supported interview links carry the exact session/country/route. Opening or preparing a subclass does not post; subclass preparation requires a click and an explicit save. A different Australian subclass cannot count as ready for the requested route; prior scope-specific evidence still needs confirmation. Return links resume the same destination session and prefetch first-render queries.

Implementation: DestinationPlan.tsx, DestinationReport.tsx, DestinationPage.tsx, destinationApi.ts, CalculatorPage.tsx and the existing router. Test-only fixtures live in src/mocks; no product mock mode was added. Older destination snapshots without plan remain readable.

Final evidence, application commits, failed preliminary checks and acceptance limits: backend docs/assessment/destination-follow-up-validation.json and destination-follow-up.fa.md in #323. Real Chromium exercised customer selection/progress/recheck/snapshot/replay, explicit route handoff/return, Persian RTL/mobile390 and keyboard against Django/PostgreSQL. Manager mobile coverage is a page smoke check; no new manager policy editor was introduced in this stage.

Final validation: **702 tests / 93 files passed** at `29fe62c`; product source is `f6e4783` and the following commit only fixes a stale-element race in the existing sales manager test. The earlier full run at `190fea7` passed 701 tests; the run at `f6e4783` had 701 passes and one existing manager-test failure, preserved in the backend report. Both original assertions and timeout were retained in a fresh-DOM wait. The fixed manager file passed all 43 cases, then the full final rerun passed. Backend: **430 tests + 126 subtests** on real PostgreSQL. Lint/typecheck/locale parity/build/size passed on product source; focused lint/typecheck passed on the test-only change. JS178.9KB/179; CSS20.5KB/20.5. No product source changed during the final complete run.
