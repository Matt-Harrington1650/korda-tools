# Current State Map

## 1) Runtime and Bootstrap
- App starts in React and conditionally enables desktop scheduler only in Tauri runtime (`C:\code\ai-tool-hub\src\main.tsx:12-14`).
- Runtime detection is centralized (`C:\code\ai-tool-hub\src\lib\runtime.ts:1-21`).
- Typed Tauri helper exists (`C:\code\ai-tool-hub\src\lib\tauri.ts:29-35`).

## 2) Route and Shell Topology
- Top-level app shell route hosts all product areas (`C:\code\ai-tool-hub\src\app\router.tsx:26-62`).
- Sophon has nested route subtree with many operational pages (`C:\code\ai-tool-hub\src\app\router.tsx:39-52`).
- Sidebar exposes many direct entry points (`C:\code\ai-tool-hub\src\app\AppShell.tsx:73-146`).

## 3) State and Workflow Orchestration
- React Query provider exists but most product state orchestration is Zustand-first (`C:\code\ai-tool-hub\src\app\providers.tsx:1-19`, `src/features/*/store`).
- Example of high page-level coupling: Workflows page binds many stores and runners (`C:\code\ai-tool-hub\src\pages\WorkflowsPage.tsx:33-48`).
- Settings page binds multiple stores and backup/update actions in one component (`C:\code\ai-tool-hub\src\features\settings\components\SettingsPanel.tsx:21-43`).

## 4) Desktop and Privileged Operations
- Desktop adapters are exposed through central exports (`C:\code\ai-tool-hub\src\desktop\index.ts:1-33`).
- SQLite desktop client uses Tauri plugin SQL with lazy loading (`C:\code\ai-tool-hub\src\desktop\sqlite\TauriSqliteClient.ts:13-22`).
- One storage bridge path currently performs direct Tauri core import in service layer (`C:\code\ai-tool-hub\src\services\storage\createObjectStoreFsBridge.ts:73-77`).

## 5) Storage and Persistence
- Storage engine selects SQLite in Tauri runtime, localStorage in browser runtime (`C:\code\ai-tool-hub\src\storage\createStorageEngine.ts:18-24`).
- SQLite storage normalizes and validates persisted rows through schemas (`C:\code\ai-tool-hub\src\storage\sqlite\SqliteStorageEngine.ts:143-206`).
- TypeScript migration transforms exist for persisted JSON payloads (`C:\code\ai-tool-hub\src\storage\migrations\index.ts:225-485`).

## 6) Rust Core and IPC Boundary
- `lib.rs` registers the full command surface and migration chain (`C:\code\ai-tool-hub\src-tauri\src\lib.rs:10-133`, `137-167`).
- SQL migration plugin registration is in startup path (`C:\code\ai-tool-hub\src-tauri\src\lib.rs:168-172`).
- Logging plugin is enabled with debug/info level split (`C:\code\ai-tool-hub\src-tauri\src\lib.rs:174-183`).

## 7) Governance and Data Integrity
- Governance SQL schema includes check constraints, foreign keys, and hash integrity guards (`C:\code\ai-tool-hub\src-tauri\migrations\0015_create_governance_core.sql:13-104`, `0016_create_deliverables.sql:1-25`, `0019_create_policy_controls.sql:1-36`).
- Rust tests verify migration ordering and idempotency behavior (`C:\code\ai-tool-hub\src-tauri\src\lib.rs:202-317`).

## 8) Extension Platform
- Plugin registry is manifest-based and type-keyed (`C:\code\ai-tool-hub\src\plugins\PluginRegistry.ts:5-58`).
- Built-in plugin manifests map tool types to adapter factories and config panels (`C:\code\ai-tool-hub\src\plugins\builtinPlugins.ts:19-68`).

## 9) KORDA-RAG Integration Reality
- Library exports exist (`C:\code\KORDA-RAG\src\nvidia_rag\__init__.py:26-33`).
- Runtime defaults remain service-first (FastAPI services, uvicorn entrypoints, compose endpoints and required keys):
  - `C:\code\KORDA-RAG\src\nvidia_rag\rag_server\server.py:103-118`
  - `C:\code\KORDA-RAG\src\nvidia_rag\ingestor_server\server.py:90-99`
  - `C:\code\KORDA-RAG\src\nvidia_rag\chat_gateway\Dockerfile:26`
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml:14,205-266`
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-ingestor-server.yaml:67-69`

## Current Architecture Statement
Current architecture is partially aligned with the target model (runtime gating, typed desktop wrappers, explicit SQL migrations), but still has concentrated orchestration in UI/store modules and uneven Tauri boundary discipline in service code.
