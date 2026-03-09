# Target Architecture v2

## Goal
Optimize KORDA Tools for offline-first desktop operation with lower cognitive load and bounded operational complexity.

## Chosen Architecture
`Thin UI + Application Services + Typed Desktop Adapters + Light Domain Model`.

Why this is selected:
- Runtime gating already exists and must remain centralized (`C:\code\ai-tool-hub\src\main.tsx:12-14`, `C:\code\ai-tool-hub\src\lib\runtime.ts:1-21`, `C:\code\ai-tool-hub\src\lib\tauri.ts:3-35`).
- The app already has adapter seams in `src/desktop` (`C:\code\ai-tool-hub\src\desktop\index.ts:1-32`).
- Workflows are currently spread across pages/stores; central application services reduce UI coupling (`C:\code\ai-tool-hub\src\pages\sophon\SophonSettingsPage.tsx:14-18`, `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:246-320`).

## Rejected Alternatives
- UI-centric architecture: rejected due high store/page coupling and direct orchestration in pages (`C:\code\ai-tool-hub\src\pages\sophon\SophonSourcesPage.tsx:31-80`, `C:\code\ai-tool-hub\src\pages\WorkflowsPage.tsx:33-47`).
- Full hexagonal/clean architecture everywhere: rejected for current team size and velocity; too much ceremony for MVP desktop scope.
- Localhost microservice-first for AI: rejected for desktop simplicity; KORDA-RAG defaults to multi-service/port topology (`C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml:211-266`, `C:\code\KORDA-RAG\deploy\compose\docker-compose-ingestor-server.yaml:165-258`).

## Target Layering

```text
UI (routes/pages/components)
  -> Application Services (use-cases/workflow orchestration)
    -> Domain (types, invariants, policy decisions)
      -> Adapters (desktop gateway, storage, secrets, AI adapters)
        -> Tauri/Rust + SQLite + object store + optional sidecar AI runtime
```

## Target Module Layout

### TypeScript
```text
src/
  app/
  routes/
  features/
  services/
  domain/
  desktop/
  config/
  shared/
```

### Rust
```text
src-tauri/src/
  lib.rs
  commands/
  services/
  db/
  models/
  security/
  filesystem/
  ai/
  logging/
  state/
```

## Hard Rules
1. No privileged desktop operation from UI modules.
2. All Tauri calls flow through typed adapters (runtime-gated).
3. React pages orchestrate views; business workflows live in services.
4. SQLite metadata is authoritative; vector index remains rebuildable/derivative.
5. Secrets only via centralized vault API.

## AI Integration Mode Decision
Preferred integration mode: `Managed sidecar worker` (Mode 2).

Evidence:
- KORDA-RAG exports library classes (`C:\code\KORDA-RAG\src\nvidia_rag\__init__.py:26-33`) and supports library mode on ingestor (`C:\code\KORDA-RAG\src\nvidia_rag\ingestor_server\main.py:108-113`, `:126-133`).
- But default runtime assumptions are service-oriented (FastAPI apps, compose host/ports, env URLs) (`C:\code\KORDA-RAG\src\nvidia_rag\rag_server\server.py:104-118`, `C:\code\KORDA-RAG\src\nvidia_rag\ingestor_server\server.py:91-99`, `C:\code\KORDA-RAG\src\nvidia_rag\chat_gateway\service.py:156-160`, `C:\code\KORDA-RAG\src\nvidia_rag\utils\configuration.py:133-135`).
- Direct in-process embedding is technically possible but high-risk without reducing external endpoint assumptions first (UNVERIFIED for production stability in this repo state).

## Operational Defaults
- Offline-first default behavior remains enforced in Sophon state (`C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:91-95`).
- Hosted inference remains optional and policy-gated (`C:\code\ai-tool-hub\src\pages\sophon\SophonSettingsPage.tsx:287-301`).
