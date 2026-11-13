# Configured program authoring and generated forms

Draft panel [#109](https://github.com/meehraaad/scorize-panel/pull/109) builds on #108 and requires [backend #324](https://github.com/shamrad/lang/pull/324), on #323. Backend first. No merge, deployment or public activation.

Managers attach a bounded program definition to a destination option for any ISO country. Questions (number/boolean/choice), all/any conditions, conditional visibility, point bands/caps, pass mark, source dates and independent reference cases are edited through structured controls. `BundleDefinitionEditor` extracts and reuses the prior generic editor; no JSON entry or per-country UI module is needed. Single-program mode permits one route matching the destination entry ID. Generic management behavior is preserved.

`ProgramPanel` renders fields from the server definition, with explicit statuses and an empty boolean prompt. Hidden/blocked questions cannot be saved. Numeric editing text remains local until explicit conversion/save; controlled invalid input stays editable after pending-request discard/reload. The parent destination editor retains unrelated program drafts and protects conflicting intake/financial/plan/recording operations. Definition adoption preserves previous unconfirmed values. Read-only history has no mutation controls.

Conditions, program-specific points and point threshold remain separate; meeting configured conditions never verifies documents or visa eligibility. A specialist calculator and configured rules cannot share one option. Generic financial mapping, arbitrary arithmetic, date/period logic and complex program exceptions remain outside this grammar. Catalog limits: 20 configured programs, 30 questions and 10 point components per program, bounded expressions/cases.

The existing destination POST adds program_answer/program_adopt with entry/question ID, program hash, status/value and the existing revision/decision hash/UUID. Responses add optional program_result. Existing pages/snapshots remain compatible. No new page/first-render query or product mock mode was introduced; mocks/fixtures are test-only.

Real Chromium/Django/PostgreSQL covered manager authoring of a synthetic Japanese program, a numeric question/all-condition/point-cap change, independent expected values and separate local review/publication. Customer generated fields, conditional questions, unknowns, unrelated edits, 400 recovery, history/replay, resume, Persian RTL/mobile390 and keyboard passed. Long question names use compact visible save labels and full accessible names.

Detailed frozen commit/test evidence, source/date limits, failed preliminary checks, 21-section audit and remaining acceptance work are in backend docs/assessment/program-builder-validation.json and program-builder.fa.md. No verified law, real financial amount/rate or public-ready country coverage is implied by these software checks.

Final frozen validation: backend `13c1fa446`, **469 tests + 126 subtests** using scorize.settings/PostgreSQL; panel `e8c379d`, **710 tests / 94 files**. Lint, typecheck, locale parity, build and strict size budgets passed (JS178.9KB/179; CSS20.5KB/20.5). Real manager/customer workflows were repeated on final code; mobile button geometry passes. Subsequent commits contain documentation only. Existing OpenAPI failures remain 19 errors / 5 unique and 28 warnings.

Follow-up: generic financial mapping is implemented by draft [#110](https://github.com/meehraaad/scorize-panel/pull/110) / backend [#325](https://github.com/shamrad/lang/pull/325); see [financial targets](assessment-generic-finance.md). The earlier scope statement above describes the program-builder delivery.
