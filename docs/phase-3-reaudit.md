# Phase 3 re-audit corrections

17 November 2026, Asia/Tehran. Based on panel `c2c80dd5a3332774ebd935697fbf38fa1cc978a0` / draft #122 and backend `71c7aa2c679e0f4adc3665f4b30e9f9e9887c731` / draft #339. The uploaded audit predates those correction heads; Astra reviewed the corrected code and identified further lifecycle/recovery gaps.

Transferred canonical answers now submit captured references, including older nested transfer candidates and captured legacy provenance. Explicit detach stays available. Preparing a profile candidate submits its single binding path, avoiding a rejected combination with automatic references. Missing document state keeps program recovery controls usable while source/date/catalog unavailability still disables answers. Unknown report skills are omitted from calculator input while retained as unknown in the canonical evidence.

Paired backend changes retain and revalidate transfer dependencies, stop coupling independent canonical reports/jobs through legacy country provenance, allow validated canonical reconfirmation, normalize unknown score projections and permit local program recovery without bypassing source gates. See the backend `docs/assessment/phase-3-reaudit.md` in the paired corrective PR for findings RA01–RA05, requirement matrix, runtime, commands, compatibility, rollback and external limits.

Validation: assessments/page-data 182 passed in 17 files; subsequent complete changed behavior suites 18 passed in four files (overlapping coverage), TypeScript and locale parity pass. Changed-file ESLint/format/whitespace and full lint status are recorded in delivery evidence. No new UI strings, routes or first-render queries. No fresh live browser/RTL/mobile, full unrelated suite, build or size claim.

Backend corrections precede this panel change. Existing panel #122 → #117 stack and backend #339 → #337 stack remain dependencies. No schema migration, merge, deployment, production document changes or legal activation. G3/A02 remains pending production serving/cache/inventory evidence, retention policy and production migration baseline. Keep protected serving and stored evidence/history when rolling back assessment functionality.
