# Phase 5 panel — unified pathway workflow

**Independent audit:** G5 was not accepted at the original head. See [audit corrections](phase-5-audit-corrections.md) for F01–F09 fixes and re-audit status. Original validation below is historical evidence, not independent acceptance.


17 November 2026, Asia/Tehran. Backend dependency: `shamrad/lang`, Phase 5 branch `codex/phase5-unified-workflow`, based on Phase 4 `1a78299a0`; delivered backend `c74d1987990692cc6bcb45611f9a88a4d4417dee`, [draft PR #341](https://github.com/shamrad/lang/pull/341). Panel parent: `c2c80dd`, `codex/phase3-shared-evidence` (#122 → #117 and its earlier stack). Deploy the corresponding backend before making this page available. This is a development-only flow; the backend requires both local mode and its assessment feature flag.

The new `/dev/assessment-workflow?session=<uuid>` route resumes an owned existing session or starts one through the existing start endpoint. The existing calculator page links to it. One shared page renders registry-discovered pathway capabilities, questions and result components without country branches. It supports explicit shared report/birth-date answers, canonical evidence selection, pause/resume, answer review, hypothetical previews, owned document links and immutable recorded results.

## Contracts and components

- `workflowApi.ts`: typed question/result/history contracts, React Query options and save API.
- `WorkflowPage.tsx`: route/session selection and applicant workflow. It does not compute legal conditions, select legal question branches or total scores locally.
- `WorkflowResults.tsx`: separate covered eligibility, each declared score system, financial fit and preference state. Reasons, missing evidence and safe source links expand on demand. Historical cards render the captured response, not a current evaluation.
- `WorkflowEvidence.tsx`: select, edit/reconfirm and attach/unlink documents on account-owned canonical evidence using the existing Phase 3 APIs. An edit invalidates affected live bindings; documents never imply verification.
- `sharedEvidenceForms.ts`: shared form schemas/normalization extracted from the existing evidence editor, reused in both flows. Existing advanced country-specific/profile/employment editing remains available through the original pages.
- `CalculatorForm.tsx`: optional server-provided question/choice labels, preserving existing default translation behavior.

The page follows existing token classes, shared form/card/button blocks, Persian/English dictionaries, logical RTL layout and lazy routing. The route declares every first-render query and a form skeleton; page-data regression checks cover both cold and resumed entry.

Question explanations name the consuming evaluations. Explicit unknown answers leave the automatic queue but remain in review. Assessment mode permits early stopping; exploration mode preserves independent score questions. Known competing reports retain separate source identities; raw report sharing does not combine legal interpretations.

## Failed saves, revisions and scenarios

A failed answer retains the exact request body/key, decision hash and revision. Inputs remain visible while the applicant retries or reloads the latest revision. Reload retains the draft; it does not silently resubmit against a new state. Unrelated controls are disabled during pending answer work. The explicit discard action clears only the local draft. Server responses provide the next revision; child operations mean a revision can advance by more than one.

Hypothetical previews call a read-only endpoint over an in-memory session copy. Current and hypothetical cards are labeled separately. No profile/evidence/history/sales mutation is made by previewing. The existing richer comparison/scenario and financial-editing pages remain available.

Workflow history has its own endpoint/payload format. Legacy calculator/reviewer history excludes these new records rather than sending old components an unknown payload. Backend details, compatibility pins, ownership and rollback are documented in `shamrad/lang:docs/assessment/phase-5-unified-workflow.md`.

## Verification and limits

Panel implementation commit: `92601fa5a5685817740e2be4e178636fd0d02645`, [draft #123](https://github.com/meehraaad/scorize-panel/pull/123). A later handoff-only commit finalizes these validation results. Tests use MSW only in the test environment; the application has no mock mode. `workflow-fixture.json` is a synthetic, typed projection of actual backend question/reference-result responses, including independently expected FSW 68 / CRS 424. It contains no real applicant data.

The new route integration cases cover failed save/retry identity, input retention after a conflict reload, explicit unknown review, separate scores, recorded history, hypothetical non-persistence, pause/resume and Persian labeled controls. Existing assessment tests and the route initial-data suite run with them. Lint, TypeScript, dictionary parity, production build and the existing first-load size check are included.

Chromium browser verification uses real Django HTTP/session authentication and a separate local PostgreSQL preview database with synthetic applicants. Desktop Persian RTL and 390 px mobile layouts, keyboard focus, horizontal overflow, injected network failure, exact retry and saved-history reload are exercised. It is not an independent screen-reader, production-device or legal-content review. A local screenshot inspection prompted collapsing long evaluator details while keeping summaries visible.

Keep the route opt-in until independent G5 review and the existing legal/privacy/retention/production migration requirements are satisfied. No merge, deployment, production migration, legal activation or Phase 6 exercise is part of this delivery. Rollback hides the route first and preserves all recorded data and protected evidence serving.

## Final validation

- `pnpm test src/features/assessments src/app/pageData.test.tsx`: **186 passed, 17 files**.
- Final affected-suite rerun (`Workflow.test.tsx`, `SharedFacts.test.tsx`, `Calculator.test.tsx`): **14 passed**. Counts overlap.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check`, production build and size checks **passed**; their raw local outputs are retained in `/workspace/phase5-evidence`.
- First-load bundle check: **JS 178.9 KB gzip / 179 KB budget; CSS 20.5 KB gzip / 20.5 KB budget**, passing without a budget change. A new width utility initially exceeded the CSS budget by seven bytes; reusing the existing page width utility corrected it.
- Ready-server browser run: **no application JS errors, no HTTP errors, no 390 px horizontal overflow**, keyboard focus and network-failure/retry plus recorded history after reload. Earlier startup-race HTTP 502 and selector mismatch are retained as failed attempts.
- Backend final: **539 tests / 73 subtests passed**. Full schema diagnostics retain the parent's **19 unrelated errors / 28 warnings**, with no new diagnostics. The build's existing Tailwind sourcemap warning is retained.

No production services, data or legal content were activated. This delivery is ready for independent Phase 5 review, not a claim that Phase 6 or the entire product is complete.
