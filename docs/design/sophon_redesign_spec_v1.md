# SOPHON Redesign Spec v1

## Definition of Done
- SOPHON shell and pages redesigned for ergonomic clarity and trust.

## User Goal
- Perform end-to-end SOPHON workflow with minimal cognitive effort.

## Design / System Goal
- Distinct hierarchy for status, actions, and grounded output.

## Tests
- Page-by-page code validation + suite pass.

## Findings
- P1 resolved: inconsistent visual grammar across SOPHON pages.
- P1 resolved: weak trust hierarchy in retrieval/readiness panels.

## Evidence
- SOPHON shell: `src/pages/sophon/SophonLayout.tsx:24-60`.
- Source workflow: `src/pages/sophon/SophonSourcesPage.tsx:80-245`.
- Retrieval output hierarchy: `src/pages/sophon/SophonRetrievalLabPage.tsx:106-135`.
- Settings trust/readiness panels: `src/pages/sophon/SophonSettingsPage.tsx:159-314`.

## Changes Applied
- Full SOPHON restyle to `kt-*` system.

## Re-test Results
- `npm run test` passed including SOPHON smoke and store tests.

## Remaining Risks
- Real-user usability timing tests remain pending.

## Spec Highlights
1. Top summary card in shell always shows runtime/queue/index/egress metrics.
2. Tab navigation styled as a single cohesive control rail.
3. Source setup fields and queue actions use consistent input/action language.
4. Job lifecycle uses explicit badges and readable progress blocks.
5. Retrieval answer is visually separated from passages and report actions.
6. Readiness checks use severity color semantics and remediation lists.
7. Backup and policy surfaces share identical interaction affordances.
