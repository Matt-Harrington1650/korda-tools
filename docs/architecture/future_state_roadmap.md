# Future State Roadmap

## Phase A - Structural Cleanup
Changes:
- Enforce centralized Tauri boundary.
- Reduce page-level orchestration by moving workflows into app services.
- Start splitting large stores by responsibility (runtime/jobs/index/settings).
- Centralize config defaults and runtime validation.

Why:
- Current coupling in pages/stores creates cognitive load (`src/pages/WorkflowsPage.tsx:33-47`, `src/features/settings/components/SettingsPanel.tsx:21-29`, `src/features/sophon/store/sophonStore.ts:167-220`).

Blast Radius:
- Medium in frontend service wiring; low in Rust.

Validation:
- `npm run lint`
- `npm run typecheck`
- `npm run test`

Rollback:
- Revert per feature module (`services/*` and `features/*`) without touching migrations.

## Phase B - Reliability Hardening
Changes:
- Normalize frontend logging with structured logger wrapper.
- Add correlation IDs for long-running workflows and Sophon actions.
- Harden error mapping at Tauri command boundary.
- Expand migration safety tests and policy-path tests.

Why:
- Current error handling is partially ad-hoc (`src/features/sophon/store/sophonStore.ts:241-243`).

Blast Radius:
- Low to medium.

Validation:
- `cargo test`
- `npm run test`
- focused smoke runs for workflow and Sophon runtime actions.

Rollback:
- Revert logging wrapper and command mapping changes; keep schema unchanged.

## Phase C - AI Integration Architecture
Changes:
- Adopt managed sidecar orchestration as primary integration mode.
- Keep adapter facade stable in desktop app.
- Add sidecar lifecycle supervision and readiness checks.
- Add explicit offline profile for degraded/no-egress behavior.

Why:
- KORDA-RAG default runtime still assumes multiple HTTP services and compose wiring (`C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml:14,205-266`, `src/nvidia_rag/chat_gateway/service.py:156-160`).

Blast Radius:
- Medium to high.

Validation:
- End-to-end startup/shutdown/retry scenarios.
- ingestion + retrieval smoke tests.
- no-port/no-service fallback behavior verification.

Rollback:
- Keep sidecar behind feature flag; fallback to current Sophon runtime mode.

## Phase D - Extensibility Platform
Changes:
- Formalize tool manifest contract versioning.
- Add compatibility checks and migration hooks for plugin manifests.
- Add guided scaffolding for new internal tools.

Why:
- Registry primitives already exist (`src/plugins/PluginRegistry.ts:5-58`, `src/plugins/builtinPlugins.ts:19-68`) and should become stable platform surface.

Blast Radius:
- Medium (tooling and plugin surface).

Validation:
- Plugin registry tests.
- Tool execution contract tests.
- tool import/export smoke tests.

Rollback:
- Versioned manifest compatibility allows fallback to previous manifest schema/adapter.

## Delivery Order
1. Phase A
2. Phase B
3. Phase C
4. Phase D

Dependency rule:
- Do not start Phase C before Phase A boundary cleanup is completed.
- Do not expand plugin surface in Phase D until logging/error standards from Phase B are in place.
