# SOPHON State Matrix

## Definition of Done
- Core SOPHON states mapped to UI behavior and trust messaging.

## User Goal
- Understand what SOPHON is doing and what action is valid now.

## Design / System Goal
- No ambiguous runtime/source/query state.

## Tests
- Store behavior review in `sophonStore.ts`.
- Page behavior review for dashboard/sources/jobs/retrieval/settings.

## Findings (severity-ranked P0/P1/P2/P3)
- P1: readiness and ingestion state are central and must always be visible.
- P2: unsupported states need consistent copy and tone.

## Evidence
- Store runtime/job lifecycle: `src/features/sophon/store/sophonStore.ts:246-360`.
- Readiness rendering: `src/pages/sophon/SophonSettingsPage.tsx:217-255`.
- Job stage rendering: `src/pages/sophon/SophonIngestionJobsPage.tsx:97-111`.

## Changes Applied
- Matrix only.

## Re-test Results
- N/A.

## Remaining Risks
- Some runtime states are bridge-dependent and can only be fully validated in desktop runtime.

| State ID | Trigger | User-facing state | Primary UI surface | Required action |
| -------- | ------- | ----------------- | ------------------ | --------------- |
| SS-001 | App enters SOPHON | Runtime summary visible | `SophonLayout` | Review runtime + queue |
| SS-002 | No sources configured | Empty source list | `SophonSourcesPage` | Add source |
| SS-003 | Source saved | Source card appears | `SophonSourcesPage` | Queue ingestion |
| SS-004 | Job queued/running | Stage progress bars and action controls | `SophonIngestionJobsPage` | Monitor / pause / cancel |
| SS-005 | Job failed | Failure reason block visible | `SophonIngestionJobsPage` | Retry or adjust source settings |
| SS-006 | Index ready | Doc/chunk stats updated | `SophonIndexPage` | Move to retrieval |
| SS-007 | Retrieval no data | "No passages" state | `SophonRetrievalLabPage` | Ingest content |
| SS-008 | Retrieval success | Answer panel + passages | `SophonRetrievalLabPage` | Validate grounded output |
| SS-009 | Readiness blocked | Severity-highlighted readiness checks | `SophonSettingsPage` | Remediate dependency or config |
| SS-010 | Backup actions | Backup/log message feedback | `SophonBackupRestorePage` | Export/restore safely |
