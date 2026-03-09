# Hotspots and Violations

## Coupling Hotspots (Top 10)
1. `P1` Workflows page orchestrates many stores directly.
- Evidence: `C:\code\ai-tool-hub\src\pages\WorkflowsPage.tsx:33-47`.
- Impact: high cognitive load and harder regression testing.

2. `P1` Settings panel combines settings, backups, credentials, update checks, and developer mode.
- Evidence: `C:\code\ai-tool-hub\src\features\settings\components\SettingsPanel.tsx:21-43`, `99-120`.

3. `P1` Sophon store contains runtime lifecycle + ingestion orchestration + policy + persistence in one store.
- Evidence: `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:167-220`, `246-340`.

4. `P2` Tool registry store includes legacy migration and secret migration behavior in state layer.
- Evidence: `C:\code\ai-tool-hub\src\features\tools\store\toolRegistryStore.ts:101-127`, `171-219`.

5. `P2` Records governance service constructor wires many cross-cutting concerns.
- Evidence: `C:\code\ai-tool-hub\src\features\records\RecordsGovernanceService.ts:173-230`.

6. `P2` Route + sidebar have many peer-level entries; discoverability and path redundancy risk.
- Evidence: `C:\code\ai-tool-hub\src\app\router.tsx:31-59`, `src\app\AppShell.tsx:73-146`.

7. `P2` Execution pipeline includes policy, DB lookup, secrets, retry, and audit responsibilities.
- Evidence: `C:\code\ai-tool-hub\src\execution\pipeline.ts:80-151`, `577-609`.

8. `P3` App shell handles welcome-modal state persistence and navigation logic directly.
- Evidence: `C:\code\ai-tool-hub\src\app\AppShell.tsx:11-61`.

9. `P3` Multiple features use parallel persistence patterns that can drift.
- Evidence: `src/features/*/store` with repeated `createStorageEngine` usage.

10. `P3` Browser/desktop dual-mode handling is repeated outside shared utility boundaries.
- Evidence: `C:\code\ai-tool-hub\src\features\tools\store\toolRegistryStore.ts:62-99`.

## Privilege Boundary Violations (Top 10)
1. `P1` Direct `@tauri-apps/api/core` import in service-layer object store bridge.
- Evidence: `C:\code\ai-tool-hub\src\services\storage\createObjectStoreFsBridge.ts:73-77`.

2. `P2` Feature-level modules instantiate desktop services directly instead of app-service wrapper.
- Evidence: `C:\code\ai-tool-hub\src\pages\sophon\SophonSettingsPage.tsx:19`, `src\features\tools\store\toolRegistryStore.ts:111`.

3. `P2` Records feature reaches desktop adapter directly from feature layer.
- Evidence: `C:\code\ai-tool-hub\src\features\records\RecordsGovernanceService.ts:1,174-179`.

4. `P2` Tool execution policy repository opens SQLite directly in execution layer.
- Evidence: `C:\code\ai-tool-hub\src\execution\pipeline.ts:91-105`, `117-145`.

5. `P2` Secret resolution is called from generic execution pipeline without dedicated privilege facade.
- Evidence: `C:\code\ai-tool-hub\src\execution\pipeline.ts:586-607`.

6. `P3` Local storage fallback and runtime checks are mixed into feature store logic.
- Evidence: `C:\code\ai-tool-hub\src\features\tools\store\toolRegistryStore.ts:62-99`.

7. `P3` Store-level runtime bridge calls expose transport concerns in state module.
- Evidence: `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:229-253`.

8. `P3` UI-level backup/export logic performs file generation and download orchestration.
- Evidence: `C:\code\ai-tool-hub\src\features\settings\components\SettingsPanel.tsx:99-120`.

9. `P3` Help-center app-state persistence is consumed directly in AppShell and Settings.
- Evidence: `C:\code\ai-tool-hub\src\app\AppShell.tsx:13-20`, `src\features\settings\components\SettingsPanel.tsx:75-82`.

10. `P3` KORDA-RAG defaults require explicit HTTP/service dependencies that conflict with desktop simplicity if embedded directly.
- Evidence: `C:\code\KORDA-RAG\src\nvidia_rag\chat_gateway\service.py:156-160`, `deploy\compose\docker-compose-rag-server.yaml:218-233`.

## Top UX Complexity Sources Caused by Architecture
1. Too many independent entry points in shell navigation.
2. Store-heavy pages requiring many simultaneous selectors.
3. Sophon operations spread across dashboard/settings/sources/jobs/index with shared mutable state.
4. Settings panel combining unrelated operational workflows.
5. Side effects (runtime checks, backup/export, key storage) initiated from UI modules.

## Priority Remediation Sequence
1. Enforce Tauri import boundary and central gateway usage.
2. Split Sophon store by domain responsibility.
3. Move page orchestration into app services for workflows/settings.
4. Introduce unified config/diagnostics service and frontend logger wrapper.
5. Keep KORDA-RAG integration behind sidecar adapter until service assumptions are reduced.
