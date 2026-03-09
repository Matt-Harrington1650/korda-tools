# Current Information Architecture

## Definition of Done
- Current route/nav map captured for core and SOPHON surfaces.

## User Goal
- Understand where each primary job lives before simplification.

## Design / System Goal
- Make core jobs route-first and reduce parallel entry confusion.

## Tests
- Router inspection: `src/app/router.tsx`.
- Shell nav inspection: `src/app/AppShell.tsx`.

## Findings (severity-ranked P0/P1/P2/P3)
- P1: SOPHON is reachable but pre-overhaul discoverability depended on sidebar scanning.
- P2: Help/settings/admin-like controls shared similar visual weight as primary jobs.

## Evidence
- Route tree: `src/app/router.tsx:26-62`.
- Shell nav groups: `src/app/AppShell.tsx:76-109`.

## Changes Applied
- None in this map file.

## Re-test Results
- N/A.

## Remaining Risks
- Route-level analytics instrumentation is absent; behavior inferred via code and smoke tests.

## Route / Surface Map
- `/` Dashboard (core)
- `/tools`, `/tools/new`, `/tools/:toolId` (core)
- `/chat` (core)
- `/workflows` (core)
- `/sophon/*` (core AI knowledge workflow)
- `/records` (secondary/admin)
- `/help`, `/help/:slug` (support)
- `/settings` (support/config)

## SOPHON Child Map
- `/sophon/dashboard`
- `/sophon/sources`
- `/sophon/ingestion-jobs`
- `/sophon/index`
- `/sophon/retrieval-lab`
- `/sophon/models-tuning`
- `/sophon/policies-audit`
- `/sophon/backup-restore`
- `/sophon/settings`
