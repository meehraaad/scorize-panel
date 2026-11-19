# Local recorded calculator flow

Depends on panel #99 and backend shamrad/lang #315 (which depends on #314 → #312).
The canonical frontend repository is `meehraaad/scorize-panel`, confirmed by the
configured remote and GitHub metadata. Neither repository is merged or deployed.

Open `/panel/dev/assessment-calculators` in a Vite development build with the
reviewed backend branch running. The route is omitted from production builds.
Django separately enforces both local flags, session ownership and staff permissions.
There is no application mock mode: MSW fixtures under `src/mocks/` are test-only.

The flow starts or resumes an owned AssessmentSession, loads versioned typed form
schemas and canonical answer identities, and records structured evidence groups.
Blank fields stay unknown; booleans and important facts are not preselected.
Work periods have explicit half-open dates. Incomplete required work fields wait
before autosave, and declaring no work history requires an explicit action.

Autosave retains one request identity for retries. Pending writes disable edits;
network/validation failures preserve input. A conflict reload retains the draft
and pauses autosave until explicit confirmation. React Query's offline pause is
shown; the same queued request resumes when online. Unsent drafts are not stored
in browser storage, and refreshing before a write completes can lose unsent input.
This is a remaining usability limitation, not durable offline storage.

Results and history distinguish current points, hypothetical nomination points,
the condition and delta, and covered Express Entry entry status. Source responses
remain self-reported and rules remain draft. Changed answers or rules mark stored
results stale; old payloads stay readable. Pagination keeps older snapshots reachable.

Staff with both review/session-view permissions can open the review queue, inspect
recorded evidence and append a note or request changes. Self-review and stale
review are denied by Django. This review cannot approve legal rules or publish them.

This is a grouped local interview/review surface. It does not implement the full
production adaptive selector, automatic profile/document import, all-country shared
work/language model, financial policy editor, recommendation/action planning,
empirical validation or consent-based service/analytics integration. Full acceptance
is tracked in backend `docs/assessment/plan-audit.fa.md`.

Verification uses the real Django/PostgreSQL backend in Chromium, including Persian
RTL at 390px, keyboard traversal, save/resume, 424/1024 separation, stale history,
offline recovery and an independent reviewer. Test mocks mirror the HTTP contract;
the independent legal/score reference tests remain in the backend.
