# SOPHON UI Audit

## Definition of Done
- SOPHON entry, tabs, and all major workflow pages audited.
- UX and trust issues ranked with severity.

## User Goal
- Upload knowledge, observe readiness, ask questions, and trust source-grounded answers.

## Design / System Goal
- SOPHON should be the clearest and most reliable workflow in the app.

## Tests (steps + commands + expected result + actual result)
1. Route + shell scan via `router.tsx` and `SophonLayout.tsx`.
- Expected: single SOPHON root with child workflows.
- Actual: one SOPHON route with nine child pages.

2. Page-level source review (`SophonDashboardPage.tsx`, `SophonSourcesPage.tsx`, `SophonIngestionJobsPage.tsx`, `SophonIndexPage.tsx`, `SophonRetrievalLabPage.tsx`, `SophonSettingsPage.tsx`).
- Expected: consistent controls and status semantics.
- Actual (pre-overhaul): mixed visual patterns and uneven hierarchy.

## Findings (severity-ranked P0/P1/P2/P3)
- P1: status visibility was present but not consistently prioritized.
- P1: answer/citation framing in Retrieval Lab lacked strong trust hierarchy.
- P1: source management overloaded first-time operators.
- P2: policy/readiness copy was clear but visually dense.
- P2: action prioritization differed page-to-page.
- P3: naming/casing inconsistencies.

## Evidence
- SOPHON tabs and top status cards: `src/pages/sophon/SophonLayout.tsx:4-60`.
- Health + control grouping: `src/pages/sophon/SophonDashboardPage.tsx:10-88`.
- Source setup density and duplicate handling: `src/pages/sophon/SophonSourcesPage.tsx:20-245`.
- Ingestion status and stage visualization: `src/pages/sophon/SophonIngestionJobsPage.tsx:13-112`.
- Retrieval answer and passage sections: `src/pages/sophon/SophonRetrievalLabPage.tsx:72-136`.
- Readiness and settings grouping: `src/pages/sophon/SophonSettingsPage.tsx:159-314`.

## Changes Applied
- None in audit phase.

## Re-test Results
- N/A.

## Remaining Risks
- Real-user clickstream timing remains simulated by code/test evidence only.
