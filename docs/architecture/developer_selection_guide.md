# Developer Selection Guide

## Purpose
This is the default decision guide for KORDA Tools contributors.

## Product Constraints
- Offline-first desktop app with optional network capabilities.
- UI must remain low-friction and predictable.
- Privileged operations must stay centralized.

Evidence: `C:\code\ai-tool-hub\src\main.tsx:12-14`, `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:91-95`, `C:\code\ai-tool-hub\src\lib\tauri.ts:3-35`.

## Default Choices
1. Overall architecture
- Use thin UI + application services + typed adapters.
- Do not put business workflow logic into pages/components.

2. State management
- React Query for async/cache lifecycle (`src/app/providers.tsx:1-19`).
- Local component state for local interaction.
- Zustand only for truly shared app state.

3. Routing
- Add routes by user job, not by technical module (`src/app/router.tsx:31-59`).
- If a capability is not a top-level job, make it a panel/modal under an existing job.

4. Desktop boundary
- Use `src/lib/tauri.ts` and desktop adapters; no raw `@tauri-apps/*` imports outside approved boundary modules.
- Feature and service modules call typed gateways, not raw `invoke`.

5. Storage
- SQLite is authoritative metadata store (`src/storage/createStorageEngine.ts:18-24`, `src-tauri/src/lib.rs:10-133`).
- Artifacts live behind object-store adapter and metadata writer (`src/services/storage/ObjectStoreService.ts`).
- Vector index is derivative, rebuildable.

6. Secrets
- Only use `createSecretVault()` and Rust secrets commands (`src/desktop/secrets/TauriSecretVault.ts:5-23`, `src-tauri/src/secrets.rs:13-33`).
- Never store secret values in settings or export payloads.

7. Rust command pattern
- Keep command functions thin and delegate to services/repositories.
- Validate input and map errors consistently.

8. AI integration
- Prefer managed sidecar for heavy/runtime-complex RAG integration now.
- Only move to in-process embedding after endpoint assumptions are removed from runtime defaults.

## When to Use Rust vs TypeScript
Use Rust when:
- Operation is privileged (filesystem/keychain/process).
- Operation must be tamper-resistant.
- Operation requires SQLite bootstrap/migration at app startup.

Use TypeScript when:
- Orchestration is UI-facing or workflow-specific.
- Logic needs fast iteration and direct integration with React state.
- No privileged capability is required.

## When to Create a New Module
Create a module when all are true:
- The logic has one clear responsibility.
- It is reused or likely to be reused.
- It can be tested independently.

Do not create a module if logic is trivial and local to one component/service.

## Dependency Acceptance Rules
Accept new dependency only if:
- No existing in-repo pattern can solve the need.
- Blast radius is bounded.
- It does not bypass desktop/security boundaries.
- It does not force always-on services for core workflows.

Reject dependency if it introduces duplicate state/runtime/config frameworks.

## Required Review Checklist
Before merge:
1. No raw `@tauri-apps/*` import outside approved boundary.
2. UI layer does not encode policy/persistence rules.
3. New persistence updates include schema/migration impact note.
4. Feature changes include tests at service or integration boundary.
5. If network required, there is an explicit offline fallback behavior.

## Current Known Exceptions (Track for Refactor)
- `src/services/storage/createObjectStoreFsBridge.ts` had direct Tauri import path and is being aligned to central gateway.
- `src/pages/WorkflowsPage.tsx` and `src/features/settings/components/SettingsPanel.tsx` still orchestrate many store actions directly.
- `src/features/sophon/store/sophonStore.ts` remains a large multi-responsibility store and should be split into runtime/jobs/index sub-stores.
