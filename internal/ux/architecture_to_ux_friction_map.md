# Architecture to UX Friction Map

## Method
Mapped visible user tasks to architecture-driven friction points using route/store/service evidence.

## Friction Map

### Task: Build and run a workflow
Friction:
- Page coordinates many independent stores and mutation paths.
- Cognitive overhead when debugging run/schedule/log issues.

Evidence:
- `C:\code\ai-tool-hub\src\pages\WorkflowsPage.tsx:33-47`
- `C:\code\ai-tool-hub\src\features\workflows\store\workflowRunStore.ts`
- `C:\code\ai-tool-hub\src\features\workflows\store\scheduleStore.ts`

UX Impact:
- Harder for users to predict where state updates appear.
- Error handling can feel inconsistent across runs/schedules.

Simplification:
- Introduce `WorkflowApplicationService` with single page-facing API.
- Keep page focused on rendering and command dispatch.

### Task: Configure app and export/import data
Friction:
- Settings panel mixes unrelated operational jobs (settings, backup, updater, developer mode).

Evidence:
- `C:\code\ai-tool-hub\src\features\settings\components\SettingsPanel.tsx:21-43`, `99-120`

UX Impact:
- Dense screen with high mode-switching cost.

Simplification:
- Split into tabs/sections with dedicated service hooks (`General`, `Data`, `Updates`, `Developer`).

### Task: Operate Sophon runtime
Friction:
- Runtime lifecycle, readiness, ingestion, indexing, and policy actions spread across many pages and one large store.

Evidence:
- Route spread: `C:\code\ai-tool-hub\src\app\router.tsx:39-52`
- Store concentration: `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:167-220`, `246-340`

UX Impact:
- Hard to understand what to do first when runtime is degraded.

Simplification:
- Add guided "Sophon readiness wizard" and compact task-oriented overview.
- Split store into runtime/jobs/index domains to reduce cross-effect bugs.

### Task: Add/manage tools
Friction:
- Tool store also carries migration and secret-migration orchestration.

Evidence:
- `C:\code\ai-tool-hub\src\features\tools\store\toolRegistryStore.ts:101-127`, `171-219`

UX Impact:
- Tool load behavior can be non-obvious when migration side effects run.

Simplification:
- Move migration orchestration to app startup service with explicit status messaging.

### Task: Navigate app areas
Friction:
- Sidebar lists many peer-level entries, some workflow-overlapping.

Evidence:
- `C:\code\ai-tool-hub\src\app\AppShell.tsx:73-146`

UX Impact:
- New users must evaluate too many equally weighted choices.

Simplification:
- Group navigation by job clusters; use progressive disclosure for advanced areas.

## Priority UX Reductions
1. Consolidate workflow orchestration behind service layer.
2. Split Settings into focused sections.
3. Add Sophon guided readiness flow.
4. Group navigation into job-based clusters.
5. Make migrations/startup side effects explicit in status UI.
