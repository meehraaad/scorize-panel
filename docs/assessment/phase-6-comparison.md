# Phase 6 — explained comparison and the third-country proof (panel)

17 November 2026, Asia/Tehran. Panel side of Phase 6 of the Immigration Pathway Finder Master Plan v2. The backend handoff, with the extension rules, the exact files each exercise changed and the acceptance matrix, is the backend's `docs/assessment/phase-6-extensions.md`. Branch `claude/youthful-thompson-03tqmp`, based on `codex/phase5-unified-workflow` (#123). Needs the backend's `unified-workflow-4` contract.

## What changed

- `WorkflowComparison.tsx` shows the selected pathways side by side, from the server's results only:
  - covered eligibility as a status chip, with the conditions still open (unmet or unknown) and any coverage reason;
  - each score in its own system. Scores are never ranked, added or compared across programs, and the page says so;
  - financial fit with its unknown reasons;
  - which declared preferences (goal, destination) match, do not match, or are not declared yet.
    It appears when two or more pathways are selected.
- Results whose evaluations carry the backend's `synthetic_not_law` limitation show a notice in the comparison and on their card: synthetic test content, not law.
- Configured programs and extensions are named only by their reviewed content: the backend's `labels` (program title, and each requirement and score component as `{text, fa?, en?}`); the current language's translation is shown before the default text, and configured questions use their `translations` the same way (`useWorkflowNames().question`). The panel's own Canadian and Australian labels are used only for specialist evaluators, so a configured check that shares an id (for example `experience`) never borrows another program's name; one without a label shows the generic "Condition". `useWorkflowNames` (`workflowNames.ts`) does this for both the comparison and the cards. Configured scores also show whether the pass mark was reached.
- New state labels for financial and extension reasons (`financial_mapping_required`, `extension_program_mismatch`, `program_source_out_of_date`, `program_source_unreviewed`, `catalog_changed`, …) in Persian and English, so no unavailability reason falls back to a bare "Review".
- `WorkflowPage` itself needed no change for a third country: a configured program's pathway title, questions (with their server labels) and results render from server data.

## Tests

`Workflow.test.tsx` adds a case with Canada and a synthetic configured third-country program: the comparison names each pathway, names configured conditions and scores from their content labels without borrowing Canadian ones, shows the pass mark, keeps the CRS in its own system, shows the financial unknown and the preference criteria, marks the synthetic content, and the third country's question renders from its configured label. Full panel suite: 752 passed; lint, typecheck and the translation check pass.

Not run: a real-browser check of the comparison at 390 px, in RTL and with the keyboard. The layout is a stacked list (no table), so it should not overflow, but that is unverified.
