# Account evidence in the calculator interview

Depends on panel #102 and [backend #318](https://github.com/shamrad/lang/pull/318),
which is based on shamrad/lang#316. Backend before panel. Existing development
routes/local gates and production flags are unchanged.

The owned-session page reads profile/applicant/CV birth dates and incomplete CV
work dates from the real API. Conflicting sources or disagreement with a saved
answer are visible. Selecting a record prepares an editable group with autosave
paused; the user must explicitly confirm. Missing required employment fields
block confirmation. Source changes/revision conflicts keep the draft until the
user explicitly discards it and refreshes. Imported evidence never updates the
profile/CV and does not attest to document authenticity or legal eligibility.

Earned education and overall test results are shown as context with missing
recognition/equivalence/four-skill requirements. Uploads expose only allowed type
and review metadata: no file contents, path or private staff notes. No OCR or
unreviewed language/education inference is performed. The API records source,
original values, conflicting alternatives and applicant corrections in immutable
snapshot provenance. Changes to referenced sources stale historical results and
block a fresh snapshot/review until the answer is checked again.

This covers structured account evidence, not all profile fields or the official
adaptive question selector. Full file extraction, shared work/language histories,
pathway comparison and action planning remain separate unfinished plan items.

Validation is recorded in the PR: PostgreSQL API regressions and actual Chromium
against Django/PostgreSQL cover explicit confirmation, no automatic import write,
conflicts, immutable provenance, source freshness, resume, Persian RTL and mobile.
