# SOPHON UX Friction Map

## Definition of Done
- Ranked top SOPHON UX friction points affecting first-time user success.

## User Goal / System Goal
- User should find SOPHON quickly, upload knowledge easily, and trust readiness/query states.

## Tests (steps + commands + expected result + actual result)
- Route/nav/findability verified from code.
- Runtime behavior and messages verified from E2E probe artifacts.
- Interactive GUI visual checks are partially unverified in this headless run.

## Findings (severity-ranked P0/P1/P2/P3)
1. P0: Ingestion can stall pending and block all answers (`sophon_runtime_worker.py:315-343`).
2. P1: Before patch, retrieval could return unrelated corpus when source not indexed.
3. P1: Duplicate upload behavior lacks clear dedupe/merge semantics (`sophon_e2e_raw.json` edge case).
4. P1: User cannot reach answer/citation phase when ingestion blocked; no alternate remediation path.
5. P2: Readiness `source_setup=warn` can coexist with non-empty index state, creating mental mismatch.
6. P2: Reflection warning noise may distract from core readiness status.
7. P2: UI-level proof of progress indicators and detailed stage messaging is unverified.
8. P2: Delete-source outcome on index/citation availability remains unverified.
9. P3: SOPHON has many sub-pages; first-run guided path is not proven in this run.
10. P3: Admin/runtime terms may be heavy for first-time non-admin users.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- `src/app/router.tsx:39-52`
- `src/app/AppShell.tsx:115-122`
- `src/features/sophon/store/sophonStore.ts:511-521,645-650`
- `src-tauri/scripts/sophon_runtime_worker.py:315-343,960-985`
- `internal/testing/artifacts/sophon_e2e_raw.json`

## Changes Applied (or none)
- Added ingestion timeout fail-fast and retrieval readiness guard.

## Re-test Results
- Stale retrieval leakage friction removed.
- Core friction (ingest never completes) persists.

## Remaining Risks
- Full UX score cannot be certified without interactive desktop run and successful ingest completion.
