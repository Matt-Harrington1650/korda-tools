# SOPHON Component Inventory

## Definition of Done
- SOPHON surfaces cataloged with route, purpose, and redesign status.

## User Goal
- Quickly locate where each SOPHON task is handled.

## Design / System Goal
- Ensure consistent component system coverage across all SOPHON pages.

## Tests
- `Get-ChildItem src/pages/sophon -File`
- Source file review for each page.

## Findings (severity-ranked P0/P1/P2/P3)
- P1: pre-overhaul pages used heterogeneous primitives.
- P2: some state panels had inconsistent card patterns.

## Evidence
- SOPHON page inventory command output.
- `src/pages/sophon/*.tsx`.

## Changes Applied
- Inventory only.

## Re-test Results
- N/A.

## Remaining Risks
- Component-level Storybook-style visual regression is not present.

| Surface ID | Route / entry path | Purpose | Primary user type | Importance (core / secondary / admin) | Current state (implemented / partial / placeholder) | Files involved | Needs redesign? yes/no |
| ---------- | ------------------ | ------- | ----------------- | -------------------------------------- | --------------------------------------------------- | ------------- | ----------------------- |
| SOPH-001 | `/sophon/dashboard` | Runtime overview and controls | Operator | Core | Implemented | `src/pages/sophon/SophonDashboardPage.tsx` | Yes |
| SOPH-002 | `/sophon/sources` | Source configuration and ingestion queueing | Operator | Core | Implemented | `src/pages/sophon/SophonSourcesPage.tsx` | Yes |
| SOPH-003 | `/sophon/ingestion-jobs` | Stage lifecycle controls and status | Operator | Core | Implemented | `src/pages/sophon/SophonIngestionJobsPage.tsx` | Yes |
| SOPH-004 | `/sophon/index` | Index operations and snapshots | Operator | Core | Implemented | `src/pages/sophon/SophonIndexPage.tsx` | Yes |
| SOPH-005 | `/sophon/retrieval-lab` | Query + answer + passage inspection | Operator | Core | Implemented | `src/pages/sophon/SophonRetrievalLabPage.tsx` | Yes |
| SOPH-006 | `/sophon/models-tuning` | Tuning and model controls | Admin/Operator | Secondary | Implemented | `src/pages/sophon/SophonModelsTuningPage.tsx` | Yes |
| SOPH-007 | `/sophon/policies-audit` | Policy controls and audit feed | Admin | Secondary | Implemented | `src/pages/sophon/SophonPoliciesAuditPage.tsx` | Yes |
| SOPH-008 | `/sophon/backup-restore` | Backup/restore and logs export | Admin | Secondary | Implemented | `src/pages/sophon/SophonBackupRestorePage.tsx` | Yes |
| SOPH-009 | `/sophon/settings` | API key + readiness + runtime settings | Admin/Operator | Core | Implemented | `src/pages/sophon/SophonSettingsPage.tsx` | Yes |
| SOPH-010 | `/sophon/*` shell | Cross-page summary + tabs | All | Core | Implemented | `src/pages/sophon/SophonLayout.tsx` | Yes |
