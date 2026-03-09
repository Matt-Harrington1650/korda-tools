# State Ownership Matrix

## Ownership Categories
- UI ephemeral: component-only state.
- Cached query state: server/adapter-backed read models.
- Shared app/session state: cross-route state with bounded scope.
- Persisted settings state: durable user/system config.
- Workflow/task state: long-running execution state.

## Current Classification

| Area | Current Owner | Evidence | Target Owner | Action |
|---|---|---|---|---|
| Router and shell nav | React Router + component state | `src/app/router.tsx:26-62`, `src/app/AppShell.tsx:8-10` | Same | Keep; avoid business logic in shell |
| Welcome modal visibility | AppShell local state + help app_state | `src/app/AppShell.tsx:11-25`, `43-61` | App service + local component state | Move persistence calls to small app-state service |
| Settings values | Zustand persisted store | `src/features/settings/store/settingsStore.ts`, `src/features/settings/components/SettingsPanel.tsx:21-24` | Zustand (persisted) | Keep but split UI workflows out of panel |
| Tool registry | Zustand persisted store + legacy migration | `src/features/tools/store/toolRegistryStore.ts:16-24`, `101-127` | Zustand persisted + migration service | Extract migration/secret migration orchestration |
| Workflow definitions | Zustand persisted store | `src/features/workflows/store/workflowStore.ts` | Zustand persisted | Keep, add application service facade |
| Workflow runs and node runs | Zustand persisted store | `src/features/workflows/store/workflowRunStore.ts` | Workflow/task state service | Add orchestration service and event model |
| Schedules + schedule logs | Zustand persisted store | `src/features/workflows/store/scheduleStore.ts`, `scheduledRunLogStore.ts` | Workflow/task state service | Keep persistence; move orchestration out of page |
| Sophon runtime/jobs/index/tuning | Single large Zustand store | `src/features/sophon/store/sophonStore.ts:167-220` | Split: runtime store, jobs store, index store, tuning store | Refactor by domain boundary |
| Credentials metadata | SQLite/local fallback service | `src/features/credentials/credentialService.ts` | Service-owned durable state | Keep with stronger adapter boundary |
| Secrets | Tauri keyring through secret vault | `src/desktop/secrets/TauriSecretVault.ts:5-23`, `src-tauri/src/secrets.rs:13-33` | Secret vault only | Keep hard boundary |
| Execution queue | Pipeline module singleton state | `src/execution/pipeline.ts` | Execution service state | Keep, but expose read model via service API |

## Mixed Ownership Risks
1. Workflows page pulls many state domains directly (`src/pages/WorkflowsPage.tsx:33-47`).
2. Settings panel mixes settings state, backup actions, and updater state (`src/features/settings/components/SettingsPanel.tsx:21-43`).
3. Sophon store owns too many state categories in one module (`src/features/sophon/store/sophonStore.ts:246-340`).

## Target Simplification Rules
1. Any state requiring side effects across modules must move to application service.
2. Stores expose pure state and simple mutations; no transport logic.
3. UI components should consume at most two store slices per screen in default flows.
4. Secret and filesystem operations remain adapter-only.

## Verification Checklist
- `npm run typecheck`
- `npm run test`
- lint pass with no raw Tauri import rule violations
