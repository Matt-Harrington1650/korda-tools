# Tauri Boundary Refactor Plan

## Objective
Ensure all privileged desktop calls flow through a centralized typed gateway and approved desktop adapter modules.

## Current Inventory
Approved boundary modules:
- `C:\code\ai-tool-hub\src\lib\tauri.ts:9-35`
- `C:\code\ai-tool-hub\src\desktop\**`

Direct Tauri import usage found:
1. `C:\code\ai-tool-hub\src\services\storage\createObjectStoreFsBridge.ts:75` (`@tauri-apps/api/core`)
2. `C:\code\ai-tool-hub\src\desktop\sqlite\TauriSqliteClient.ts:16` (`@tauri-apps/plugin-sql`) - allowed (desktop layer)
3. `C:\code\ai-tool-hub\src\lib\tauri.ts:9-26` - allowed (central wrapper)

## Refactor Scope
Phase 1 (low risk):
- Replace direct invoke import in `createObjectStoreFsBridge.ts` with `tauriInvoke` wrapper.
- Add lint guardrail to block `@tauri-apps/*` imports in `src/**` except `src/lib/tauri.ts` and `src/desktop/**`.

Phase 2:
- Audit any future exceptions and move to desktop adapter modules.
- Add CI check to fail boundary violations.

## Patch Sequence
1. Patch storage bridge invoke path.
- File: `src/services/storage/createObjectStoreFsBridge.ts`
- Change: remove local dynamic import of core invoke; call `tauriInvoke`.
- Blast radius: low.
- Rollback: revert single file.

2. Patch lint config boundary rule.
- File: `eslint.config.js`
- Change: add `no-restricted-imports` rule for `@tauri-apps/*` in non-boundary files.
- Blast radius: low-medium (may surface existing violations).
- Rollback: revert config block.

## Validation
- `npm run lint`
- `npm run typecheck`
- `npm run test -- src/services/storage` (or full `npm run test`)

## Exit Criteria
- No raw `@tauri-apps/*` imports outside approved boundaries.
- Storage bridge behavior unchanged in both web and Tauri runtime.
- Lint enforces guardrail for future changes.
