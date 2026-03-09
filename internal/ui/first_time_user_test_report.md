# First-Time User Test Report

## Definition of Done
- First-time SOPHON user journey simulated and recorded.

## User Goal
- Find SOPHON fast, add source, understand readiness, and ask a first question.

## Design / System Goal
- Strong first-use clarity with low cognitive overhead.

## Tests
- Simulated via route + UI state inspection and automated smoke tests.
- `npm run test` including SOPHON route smoke.

## Findings (severity-ranked P0/P1/P2/P3)
- P1: none after redesign.
- P2: true human timing measurements are estimated, not instrumented.

## Evidence
- SOPHON entry availability: `src/app/AppShell.tsx:93-95`.
- SOPHON quickstart guidance on dashboard: `src/pages/DashboardPage.tsx:74-80`.
- Source onboarding messaging: `src/pages/sophon/SophonSourcesPage.tsx:167-176`.

## Changes Applied
- Included in UI implementation patch set.

## Re-test Results
- All relevant tests passing.

## Remaining Risks
- Human-subject timing variance remains UNVERIFIED.

| Test ID | User Task | Expected Time / Clarity | Actual Outcome | Pass/Fail | Severity | Evidence |
| ------- | --------- | ----------------------- | -------------- | --------- | -------- | -------- |
| FT-001 | Launch app and identify primary areas | < 20s orientation | SOPHON visible in core workflow nav and dashboard CTA | Pass | P3 | `src/app/AppShell.tsx:76-99`, `src/pages/DashboardPage.tsx:63-65` |
| FT-002 | Find SOPHON | < 30s | Direct sidebar link and dashboard button | Pass | P3 | same as above |
| FT-003 | Understand SOPHON purpose | Immediate from header copy | Header states ingestion/index/retrieval purpose | Pass | P3 | `src/pages/sophon/SophonLayout.tsx:28-31` |
| FT-004 | Add first source | Form understandable with labeled controls | Inputs normalized + explicit error messaging | Pass | P3 | `src/pages/sophon/SophonSourcesPage.tsx:80-166` |
| FT-005 | See indexing status | Job state visible | Ingestion job statuses + progress bars present | Pass | P3 | `src/pages/sophon/SophonIngestionJobsPage.tsx:97-111` |
| FT-006 | Ask first question | Input + run action obvious | Retrieval input and run button clear | Pass | P3 | `src/pages/sophon/SophonRetrievalLabPage.tsx:78-105` |
| FT-007 | Validate trust/readiness | Readiness info accessible | Settings page exposes readiness checks and remediation | Pass | P3 | `src/pages/sophon/SophonSettingsPage.tsx:217-255` |
