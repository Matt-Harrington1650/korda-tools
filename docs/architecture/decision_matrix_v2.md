# Decision Matrix v2

## Scope
This matrix selects defaults for KORDA Tools architecture based on current code and KORDA-RAG constraints.

Evidence anchors:
- Runtime gate and typed Tauri wrapper: `C:\code\ai-tool-hub\src\main.tsx:12-14`, `C:\code\ai-tool-hub\src\lib\runtime.ts:1-21`, `C:\code\ai-tool-hub\src\lib\tauri.ts:1-35`.
- Current route and UI shape: `C:\code\ai-tool-hub\src\app\router.tsx:26-62`, `C:\code\ai-tool-hub\src\app\AppShell.tsx:64-157`.
- State/store density: `C:\code\ai-tool-hub\src\pages\WorkflowsPage.tsx:33-47`, `C:\code\ai-tool-hub\src\features\settings\components\SettingsPanel.tsx:21-29`, `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:167-220`.
- KORDA-RAG service orientation: `C:\code\KORDA-RAG\src\nvidia_rag\rag_server\server.py:103-118`, `C:\code\KORDA-RAG\src\nvidia_rag\ingestor_server\server.py:90-99`, `C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml:211-266`, `C:\code\KORDA-RAG\deploy\compose\docker-compose-ingestor-server.yaml:67-69`.

## 1) Overall Architecture Style
Options:
- A: Thin UI + app services + adapters.
- B: Feature-sliced vertical silos only.
- C: UI-centric monolith.
- D: Full hexagonal everywhere.

Recommendation: **A (default) with selective B for feature folders**.
Why:
- Existing runtime/desktop boundary already exists and is compatible with A (`src/lib/tauri.ts:1-35`, `src/desktop/index.ts:1-33`).
- C increases coupling already visible in page-level multi-store orchestration (`src/pages/WorkflowsPage.tsx:33-47`).
- D adds ceremony not justified by current team/runtime footprint.

## 2) State Management
Options:
- A: React Query + local state + minimal Zustand.
- B: Zustand-first global state.
- C: Redux Toolkit everywhere.
- D: XState everywhere.

Recommendation: **A**, with XState only for complex long-running flows.
Why:
- Query provider exists and is stable (`src/app/providers.tsx:1-19`).
- Current Zustand usage is broad and already creating page orchestration density (`src/features/sophon/store/sophonStore.ts:246-340`, `src/features/settings/components/SettingsPanel.tsx:21-29`).

## 3) Route and Navigation
Options:
- A: Job-oriented route tree.
- B: Tool-launcher dashboard with many competing entries.

Recommendation: **A**.
Why:
- Existing route tree is already route-first and should be consolidated by user job (`src/app/router.tsx:31-59`).
- Sidebar currently exposes many parallel entry points; this should be grouped by workflow (`src/app/AppShell.tsx:73-146`).

## 4) Tauri Boundary
Options:
- A: Central typed desktop gateway.
- B: Feature-level invoke/import calls.

Recommendation: **A (hard rule)**.
Why:
- Wrapper exists (`src/lib/tauri.ts:29-35`) and should be single choke-point.
- One non-conforming call site exists in services and is refactor target (`src/services/storage/createObjectStoreFsBridge.ts:73-77`).

## 5) Rust Backend Organization
Options:
- A: Thin commands delegate to services.
- B: Command-heavy business logic.

Recommendation: **A**.
Why:
- `lib.rs` already centralizes command registration and setup (`src-tauri/src/lib.rs:137-185`).
- Commands/services split exists in tools/help modules and should be formalized further (`src-tauri/src/tools/commands.rs:96-169`, `src-tauri/src/help/commands.rs:27-120`).

## 6) Domain Modeling
Options:
- A: Light domain model for high-value entities.
- B: DTO/schema-first everywhere.
- C: Rich domain model everywhere.

Recommendation: **A**.
Why:
- Important entities/policies already exist and are practical in service layer (`src/services/policy/FailClosedPolicyEnforcer.ts`, `src/services/deliverables/DeliverableService.ts`).
- Full rich model everywhere would over-expand current complexity surface.

## 7) Storage Architecture
Options:
- A: SQLite authoritative metadata + managed artifact storage.
- B: SQLite-only including all binaries.
- C: Multi-store by default.

Recommendation: **A**.
Why:
- Runtime switch and SQLite path already implemented (`src/storage/createStorageEngine.ts:18-24`, `src/storage/sqlite/SqliteStorageEngine.ts:275-295`).
- Object-store abstraction exists for artifacts (`src/services/storage/ObjectStoreService.ts`, `src/services/storage/LocalObjectStoreAdapter.ts`).

## 8) Migration Strategy
Options:
- A: Forward-only SQL migrations.
- B: ORM auto-sync.

Recommendation: **A**.
Why:
- Explicit migration chain exists (`src-tauri/src/lib.rs:10-133`) and is tested for idempotency (`src-tauri/src/lib.rs:258-317`).
- Governance tables include constraints/FKs/checks (`src-tauri/migrations/0015_create_governance_core.sql:13-104`, `0019_create_policy_controls.sql:1-36`).

## 9) AI Integration Model
Options:
- A: Embedded in-process library.
- B: Managed sidecar worker.
- C: Localhost microservice mesh.

Recommendation: **B now**, revisit A after endpoint assumption reduction.
Why:
- Library entry points exist (`C:\code\KORDA-RAG\src\nvidia_rag\__init__.py:26-33`, `ingestor_server/main.py:108-133`).
- Default runtime is still HTTP/service-oriented with compose-level coupling (`deploy/compose/docker-compose-rag-server.yaml:14,205-266`, `chat_gateway/service.py:156-160`, `utils/configuration.py:133-135`).

## 10) Extension and Tooling Architecture
Options:
- A: Manifest-based internal registry.
- B: Arbitrary script runner.
- C: Full signed external plugin ecosystem.

Recommendation: **A**.
Why:
- Registry and typed manifests are in place (`src/plugins/PluginRegistry.ts:5-58`, `src/plugins/builtinPlugins.ts:19-68`).
- B is high risk for security and support burden.

## 11) Config Strategy
Options:
- A: Central typed config service.
- B: Feature-local constants.

Recommendation: **A**, with staged migration.
Why:
- KORDA-RAG shows config sprawl risks (many env-driven defaults) (`C:\code\KORDA-RAG\src\nvidia_rag\utils\configuration.py:127-137`, `734-737`, `815-818`, `864-877`).
- KORDA Tools should avoid duplicating this pattern in frontend features.

## 12) Logging and Observability
Options:
- A: Structured app-wide logging with correlation IDs.
- B: Ad-hoc console logging.

Recommendation: **A**.
Why:
- Rust logging plugin is configured (`src-tauri/src/lib.rs:174-183`).
- Frontend still has direct console error logs in critical flows (`src/features/sophon/store/sophonStore.ts:241-243`), which should be normalized.

## 13) Testing Strategy
Options:
- A: Unit + integration heavy, limited UI smoke.
- B: UI-heavy tests.

Recommendation: **A**.
Why:
- Strong service/storage test coverage already exists and is lower maintenance (`src/storage/sqlite/SqliteStorageEngine.test.ts`, `src/services/storage/ObjectStoreService.test.ts`, `src/execution/pipeline.test.ts`).

## 14) Packaging and Deployment
Options:
- A: Single desktop package + optional heavy capability packs.
- B: Multiple required local services by default.

Recommendation: **A**.
Why:
- Desktop boundary and offline posture are core product constraints (`src/features/sophon/store/sophonStore.ts:91-95`).
- KORDA-RAG compose topology remains valid for development/sidecar, not primary end-user install path.
