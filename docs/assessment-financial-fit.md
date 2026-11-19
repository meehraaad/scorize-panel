# Financial fit and financial-policy authoring

Draft backend [shamrad/lang#321](https://github.com/shamrad/lang/pull/321) extends
comparison #320. This panel builds on #105. Install the backend chain first,
then this panel. The existing Vite development routes and both backend sandbox
gates remain; there is no new production feature flag, mock mode or activation.

On `/dev/assessments`, staff add a financial policy to the existing reviewed draft
workflow. `FinancialPolicyEditor` provides range IDs/titles/inclusive bounds,
enabled/order, open-range treatment, financial thresholds, rounding, FX freshness,
dated rational rates and independent application/tuition/living/proof components.
`FinancialScenarioEditor` records independent expected financial outcomes alongside
the existing scenarios. Actual/expected and actual previous-version outcomes are
shown in the existing validation report. Published content cannot be edited;
copy it for another version. Existing role separation and source/date checks apply.

On `/dev/assessment-calculators`, `FinancialPanel` explicitly opens owned financial
questions without adding an initial request waterfall. It keeps willingness to
spend, resource amounts/allocations, accompanying dependants and proof family
membership distinct. Exact budget is requested by the server only when needed
inside the chosen range; a previously supplied exact value remains editable.
`FinancialResult` renders financial status, unknowns, assumptions, separate cost/
proof components, sources and effective/review/receipt/expiry dates. Source links
use safeHref. Comparison displays the same recorded result and concrete financial
information/gap actions, independently of requirements and country-specific scores.

Known financial facts remain self-reported. An action marked done does not verify
funds, documents or eligibility. No rank compares CRS to Australian points. Missing
or stale references remain unknown; no real cost, FX rate or legal family schedule
is seeded. The official calculators still declare coverage through 2026-11-12.

Writes require session revision, decision hash and UUID. An uncertain retry keeps
its exact body/key; conflicting tabs require a refresh while preserving local
input. Saving one field retains unrelated dirty fields. Dirty or pending financial
input protects the interview/comparison against conflicting writes. Refresh updates
both financial and interview revisions. Scenario preview does not save anything.
Explicit policy adoption after a version change retains old facts for reconfirmation.

The test-only MSW handlers mirror `/financial/`, `/financial/scenario/`, comparison
and management options. `calculator-financial.json` is a synthetic backend-generated
contract fixture, not product data. There is no runtime fixture fallback.

The old profile, estimate and sales budgets retain their None/1/2/3 enum meanings.
New assessment range versions coexist with them and require an explicit answer;
there is no automatic backfill, exact-money inference, profile transfer or lead.

Validation is recorded in backend
[financial-validation.json](https://github.com/shamrad/lang/blob/codex/assessment-finance/docs/assessment/financial-validation.json),
with [scope/contract](https://github.com/shamrad/lang/blob/codex/assessment-finance/docs/assessment/financial-fit.md)
and [Persian audit/report](https://github.com/shamrad/lang/blob/codex/assessment-finance/docs/assessment/financial-fit.fa.md).
The focused suite includes exact-question dependency, independent proof-family
entry, unchanged point interview, read-only scenario, no initial finance request,
uncertain retry, unsaved fields, tab conflict, safe source links, draft authoring
and the admin request-key retry. Actual Chromium exercised Django/PostgreSQL,
manager/reviewer/publisher accounts, Persian/English, RTL/mobile390, keyboard,
controlled errors and preserved inputs, comparison snapshots and replay.

Technical readiness is a tested local review flow. Real financial content, legal
approval, the prior chain's real migration baseline and pilot acceptance still
block public release. No merge, deployment, production migration or public
activation occurred.

Frozen application `b459505` passed the complete **679-test / 91-file** panel run;
all **48 focused assessment tests** passed, including 12 new financial tests.
Lint, typecheck, locale parity, production build and size passed: JS178.8KB/179KB,
CSS20.5KB/20.5KB. Backend application `156b52571` passed **371 tests and 126
subtests** with actual PostgreSQL/project settings. Its schema retains the same
19 existing errors/5 unique and 28 warnings. Later commits only add documentation.
