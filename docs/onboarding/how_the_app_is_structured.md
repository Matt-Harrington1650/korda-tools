# How the App Is Structured

## Top-Level Layers
1. `src/app` and `src/pages`
- Routing, shell, and page composition.

2. `src/features`
- Feature-focused state, hooks, forms, and UI modules.

3. `src/services`
- Cross-feature orchestration and infra-facing services.

4. `src/domain` and `src/schemas`
- Core domain types and validation schemas.

5. `src/desktop`
- Desktop adapters for SQLite, secrets, files, updater.

6. `src/storage`
- Runtime-selected persistence engine and migration transforms.

7. `src-tauri/src`
- Rust command boundary, services, object store, secrets, runtime worker control.

## Data and Control Flow
- UI dispatches actions.
- Feature/app services execute workflows.
- Services call desktop adapters.
- Adapters call Tauri commands or browser fallbacks.
- SQLite + object storage persist state/artifacts.

## Important Boundaries
- Tauri boundary: `src/lib/tauri.ts` + `src/desktop/**`
- Secret boundary: `src/desktop/secrets/*` and `src-tauri/src/secrets.rs`
- Migration boundary: `src-tauri/migrations/*.sql` and `src-tauri/src/lib.rs` migration chain.

## Known Heavy Modules
- `src/features/sophon/store/sophonStore.ts`
- `src/features/records/RecordsGovernanceService.ts`
- `src/execution/pipeline.ts`

Treat these as high-impact files: make small, tested edits.
