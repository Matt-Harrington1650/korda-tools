# Target Information Architecture v1

## Definition of Done
- Target route and navigation hierarchy aligned with user jobs.

## User Goal
- One obvious path for SOPHON and core tooling workflows.

## Design / System Goal
- Stable shell + route-first structure + progressive disclosure.

## Tests
- Existing route map review (`router.tsx`) and shell nav updates (`AppShell.tsx`).

## Findings
- P1 resolved: SOPHON promoted into core workflow grouping and dashboard CTA.

## Evidence
- Route map: `src/app/router.tsx:26-62`.
- Nav groups + SOPHON placement: `src/app/AppShell.tsx:76-109`.
- Dashboard SOPHON quick access: `src/pages/DashboardPage.tsx:63-65`.

## Changes Applied
- IA guidance implemented in shell and dashboard.

## Re-test Results
- Route smoke tests and full suite passed.

## Remaining Risks
- IA telemetry remains uninstrumented.

## Target IA
- Core
  - Dashboard
  - Tools Library
  - Add Custom Tool
  - Workflows
  - Chat
  - Sophon (dashboard, sources, jobs, index, retrieval, tuning, policy, backup, settings)
  - Records
- Support
  - Start Here (Help)
  - Settings

## SOPHON Flow Priority
1. Dashboard
2. Sources
3. Ingestion Jobs
4. Index
5. Retrieval Lab
6. Advanced/admin pages (Models, Policy, Backup, Settings)
