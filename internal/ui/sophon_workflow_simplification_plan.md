# SOPHON Workflow Simplification Plan

## Definition of Done
- Current SOPHON journey reduced to a clear, low-ambiguity sequence.

## User Goal
- Move from empty state to grounded answer quickly.

## Design / System Goal
- One dominant next action at each step.

## Tests
- Path walk through SOPHON pages + store actions.
- Smoke test coverage via `SophonRouting.smoke.test.tsx`.

## Findings (severity-ranked P0/P1/P2/P3)
- P1: Source setup and readiness lacked guided progression.
- P2: Retrieval and trust cues needed stronger presentation hierarchy.

## Evidence
- SOPHON tabs and summary cards: `src/pages/sophon/SophonLayout.tsx:24-60`.
- Source add + queue flow: `src/pages/sophon/SophonSourcesPage.tsx:80-245`.
- Retrieval output: `src/pages/sophon/SophonRetrievalLabPage.tsx:106-135`.

## Changes Applied
- Plan only.

## Re-test Results
- N/A.

## Remaining Risks
- True time-on-task measurements are not instrumented.

## Simplified Journey
1. Enter `Sophon Dashboard`.
2. Confirm runtime status in top summary.
3. Open `Sources` and create source.
4. Queue ingestion from source row.
5. Monitor `Ingestion Jobs`.
6. Verify `Index` stats.
7. Ask in `Retrieval Lab`.
8. Validate trust/readiness in `Settings` if needed.

## UX Rules Applied
- Primary action prominence (`kt-btn-primary`).
- Secondary actions consistently subdued (`kt-btn-secondary`, `kt-btn-ghost`).
- Empty states always include next-step guidance.
- Runtime/readiness context always visible at SOPHON shell level.
