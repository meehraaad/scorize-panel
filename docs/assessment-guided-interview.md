# Guided calculator interview

Delivery [panel #104](https://github.com/meehraaad/scorize-panel/pull/104) depends
on [backend #319](https://github.com/shamrad/lang/pull/319) (based on #318) and panel #103. The existing development-only route and production flags stay as
before. No merge, deployment or legal release is included.

Applicants explicitly start/resume guidance for the country chosen in the form.
The server selects a relevant group from current calculator requirements and
unresolved score components, with an explanation. The selected question focuses
the editor. Explicit unknown defers the group rather than entering a negative
answer; pause persists a request for the current partial result. Manual edits and
reviewed account imports remain available, and dirty input cannot be replaced.

A suggested answer carries its decision hash. The server checks revision,
country/question, policy, rules/source/code/date/runtime context and records the
selection trace. Pinned versions are never upgraded silently. The read-only GET
never starts a session or writes. Reviewer details expose relative cost and
priority, dependencies and exclusions; ordinary applicants receive human reasons.

Uncertain start/stop retries retain their exact UUID/body. A refresh updates both
interview revision and guidance and freezes controls until both finish, so another
tab's answer cannot leave the guided controls on a stale revision. Source changes
are an explicit reason to recheck an answer. Unknown, unsupported and uncertain
facts stay partial; known failed checks stop only the covered routes. Scenario
mode does not pretend failed conditions were fulfilled.

Ten targeted UI regressions cover advancement after unknown, persisted stop,
exact retry, dirty-form protection, cross-tab revision refresh, Australia route
setup, permitted policy inspection and separate Australian points/requirements and explicit source reconfirmation. Backend tests compare complete and guided
Canada/Australia cases. Final static/full-suite and actual Django/PostgreSQL
browser results are recorded in the PR.

This remains a local flow over draft legal content. Full public intake, multi-path
preferences/comparison/action plans, financial policy signals, no-code selection
policy editing and legal/operational pilot acceptance remain unfinished.

Actual Chromium against Django/PostgreSQL passed the Canadian explicit-start,
unknown, persisted-pause/resume and partial-result flow. Australia also passed
route setup, known-condition stop, explicit scenario with the failed age check
unchanged, separate points/requirements, snapshot replay and readable history
when an old pin is unavailable. Mobile width 390 and Persian RTL had no overflow
or page errors.

A changed source can be explicitly reconfirmed with the existing value. Preparing
that answer pauses autosave; only an explicit save reasserts it as the applicant's
answer. New writes cannot bypass an unavailable pin via manual editing.

Australian calculation/recording stays disabled until a supported, current-version
subclass answer is explicit. Deferring the route preserves the answers and gives
a clear reason instead of assuming a subclass. Resuming restores the pinned
country without replacing an existing navigation choice or dirty/queued input.
History labels its country and supplied Australian subclass.
