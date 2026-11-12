# Legacy estimator contract correction

Depends on panel #101 and backend shamrad/lang #316. Install the backend first;
no production activation, deployment or merge is included.

Responses explicitly identify `assessment_scope=academic_admission` or
`work_not_supported`; old responses without the field remain readable. The work
scope means this academic estimator does not cover the goal, not that the person
fails migration requirements. Both full-page and compact mobile results preserve
this distinction instead of showing an insufficient-admissions-data message.

A work-only goal stops after the goal question and submits only that intent and
`contact.channel=none`. No GPA, degree, English score, budget or destination is
invented or collected to obtain an unsupported result. Receiving the result does
not grant contact permission. Study/both goals retain the academic flow. The test
mock follows the backend's scope and no longer treats an unbounded budget as
unlimited funds.

Actual cold-browser validation exposed an existing frame bug: a disabled session
QueryObserver cancelled a loader-owned request during StrictMode cleanup. The
workspace now subscribes passively to cached identity and keeps its app-lifetime
cache retention. A failing-before/passing-after regression exercises the real
QueryClient under StrictMode; ordinary panel/page-data tests cover role behaviour.
StrictMode remains enabled and cancellation is not hidden with a catch-all.

This does not complete the new adaptive migration product, official content
approval, financial policy editor or empirical validation. Source and release
limits remain in the backend's plan audit. Existing server-feature flags are
unchanged.
