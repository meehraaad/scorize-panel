# Local route comparison and action plans

The development calculator interview now opens a comparison panel on demand.
Cards separate covered conditions, CRS/FSW selection/Australian points and
conditional totals. Users select display routes/order, open related evidence,
report action progress and explicitly record comparison history.

The order is the user's selection order, not a suitability ranking; country
scores do not share a scale. Costs, timelines and historical probability are
unavailable. FST and other-subclass Australian evidence gaps remain explicit.
This is development-only draft content, not the public assessment launch.

Completing an action never changes a fact, score, legal condition or review flag.
Remaining gaps marked done require reassessment. Shared information tasks are
canonical, and dependencies precede the checks/review they support. A current
unmet age condition is a barrier to review, not a promise of improvement.

Dirty/queued interview forms cannot be replaced. Opening an existing answer from
an action prepares explicit confirmation and pauses autosave. New Australian
route, qualifying-work and partner claims bind to the declared subclass; changing
subclass requires confirmation instead of transplanting claims. A missing subclass
is never filled with189 implicitly. Independent simultaneous subclass histories
remain unfinished.

Uncertain mutations retain their exact UUID/body. Conflict recovery refreshes both
comparison and interview revisions and preserves unsaved route choices. Recording
stays disabled until those choices are saved. Historical comparison plans are
read-only and stale records stay readable. Existing independent reviewers can
inspect original provenance for both countries. Source URLs use safeHref.

API contract: backend `shamrad/lang#320` (`docs/assessment/route-comparison.md`).
Endpoints: owned/local `GET/POST calculators/comparison/`, explicit
`POST calculators/comparison/snapshots/`, existing snapshot history/replay/review.
No production flag, lead/contact, purchase or deployment is added.

Dependencies: panel #105 → #104 → #103, and backend #320 → #319 → #318.
Backend must precede panel. Both PRs are draft and attached to the task.

Eight new UI tests cover separate scales/conditions, explicit unsupported/missing
route evidence, progress without fulfilled conditions, immutable history display,
dirty-form protection, exact-body retry, cross-tab refresh with unsaved selections,
hypothetical nomination and unsafe source links. With existing calculator/profile/
guidance tests, the focused run passed26 tests. The Django-generated synthetic
fixture is test-only; it includes the UI contract and captured original evidence,
not a production mock mode.

The first assertions expected one CRS label even though FSW/CEC each display it,
and recording to unlock with unsaved selections after a conflict. Corrected
assertions preserve intended behavior. An overlapping outdated run timed out in
an existing profile test; the frozen final run is isolated to one test worker.
Lint found a redundant type assertion, literal punctuation outside the dictionary
and an unused type import; these were fixed without suppressions. No tests were
removed and no timeouts were increased.

Actual Chromium against Django/PostgreSQL passed GET without writes, distinct
CRS424/AU75, unsupported/subclass-specific evidence, progress without changed
conditions, immutable comparison/replay, stale history, selection/progress resume
and Persian RTL/mobile390. The first browser script targeted a visually hidden
checkbox input; clicking its visible label reproduced the user's actual action.

Remaining: public intake/preferences and suitability policy, independent route
histories, complete document catalogue, versioned financial/time references,
historical evidence, broader language/budget scenarios and legal/pilot acceptance.
The backend's 21-section plan audit remains the acceptance checklist.

Frozen application commit `10a2588`: full lint, typecheck, translation parity,
production build and size checks passed (JS178.8KB/179KB; CSS20.5KB/20.5KB).
The final backend passed308 tests and126 subtests on actual PostgreSQL.
After its last scope correction, both real-browser flows passed again, including
subclass189→190 and explicit unchanged-value invitation confirmation without
autosave; other scoped claims remained unknown. An initial relative locator
included the enclosing region within an action-list filter and matched nothing;
targeting the actual select control's ancestor fixed only the test fixture.
