# Architecture Quickstart

## 15-Minute Orientation
1. Open runtime boundary files first:
- `src/main.tsx`
- `src/lib/runtime.ts`
- `src/lib/tauri.ts`

2. Open app shell and routing:
- `src/app/router.tsx`
- `src/app/AppShell.tsx`

3. Open state orchestration examples:
- `src/features/tools/store/toolRegistryStore.ts`
- `src/features/sophon/store/sophonStore.ts`
- `src/pages/WorkflowsPage.tsx`

4. Open desktop adapters:
- `src/desktop/index.ts`
- `src/desktop/sqlite/TauriSqliteClient.ts`
- `src/desktop/secrets/TauriSecretVault.ts`

5. Open Rust command boundary and migrations:
- `src-tauri/src/lib.rs`
- `src-tauri/migrations/*.sql`

## Mental Model
UI -> Application Services -> Domain Rules -> Desktop/Storage Adapters -> Rust Commands/SQLite.

## What Not To Do
- Do not import `@tauri-apps/*` directly from feature/UI modules.
- Do not put business workflow logic in page components.
- Do not put secrets in persisted settings or export files.

## Validation Commands
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `cd src-tauri && cargo test`

## First Contribution Checklist
1. Identify layer for the change.
2. Add/modify tests at service or boundary level.
3. Confirm no boundary violations.
4. Run validation commands before commit.
