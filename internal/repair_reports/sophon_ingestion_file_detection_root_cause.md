# Sophon Ingestion File Detection Root Cause

## Executive Findings
- Enumerate failures were reproducible with valid supported files and the same failure signature reported by users.
- Root cause #1 was a mode-resolution bug: when `sourceType="folder"` but `path` points to a file, enumerate used `rglob` on a file path and returned zero matches.
- Root cause #2 was settings divergence: legacy include globs (`pdf/docx/md` only) conflicted with broader `allowedExtensions` and blocked valid files like `.dwg`.
- The failing error path was in `queue_ingestion` after `list_files` returned empty.
- The issue was backend logic (worker enumerate behavior), not only UI copy.

## Definition of Done
- Root cause is proven with runtime reproduction and code evidence.
- Exact settings path producing `Include` and `AllowedExtensions` is mapped.

## Goal
- Identify why valid files fail at stage `enumerate` with `No files matched source settings`.

## Tests (commands run + expected result + actual result)
1. `rg -n -S "No files matched source settings" src-tauri/scripts/sophon_runtime_worker.py`
- Expected: identify fail site.
- Actual: fail message at `sophon_runtime_worker.py:1110` (post-fix line; same branch as pre-fix).

2. `python internal/testing/repro_enumerate_failure.py` (pre-fix evidence run)
- Expected: reproduce reported failure.
- Actual: both repro cases failed with `No files matched source settings...` and `discoveredFiles: 0`.

3. `rg -n -S "add_source|queue_ingestion" src/features/sophon/store/sophonStore.ts src-tauri/scripts/sophon_runtime_worker.py`
- Expected: map settings + handoff.
- Actual: source settings sent from store, ingested by worker `add_source`, then used by `queue_ingestion`.

## Findings (severity-ranked P0/P1/P2/P3)
- P0: File path misclassified as folder scan caused false zero-match enumerate failures.
- P1: Legacy include patterns (`pdf/docx/md`) could suppress other allowed extensions (`dwg/dxf/ifc/xlsx/csv/txt/jpg/png`).
- P2: Failure diagnostics were too opaque for fast triage (no candidate/rejection breakdown).

## Evidence (file paths + line ranges + command output + logs + DB/state evidence)
- Backend fail site: `C:\code\ai-tool-hub\src-tauri\scripts\sophon_runtime_worker.py:1104-1121`.
- Source settings handoff: `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:454,514`.
- Runtime invoke bridge: `C:\code\ai-tool-hub\src\features\sophon\runtime\sophonRuntimeBridge.ts:14-20`.
- Tauri command registration: `C:\code\ai-tool-hub\src-tauri\src\lib.rs:147`.
- Store defaults (canonical extension set): `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:46-49`.

### Contract/Settings Trace
| Setting Path ID | Source Layer | File | Field/Function | Produced Value | Expected Value | Status | Evidence |
|---|---|---|---|---|---|---|---|
| SP-01 | UI form defaults | `src/pages/sophon/SophonSourcesPage.tsx` | `includePatterns` input default | historically narrow (`pdf/docx/md`) in existing sources; now `**/*` | broad discovery + extension gate | FIXED | `SophonSourcesPage.tsx:14` |
| SP-02 | Frontend store | `src/features/sophon/store/sophonStore.ts` | `sourceDefaults.allowedExtensions` | full supported set | full supported set | CONFIRMED | `sophonStore.ts:46-49` |
| SP-03 | Frontend -> runtime | `src/features/sophon/store/sophonStore.ts` | `add_source` invoke payload | include+allowed forwarded | include+allowed forwarded | CONFIRMED | `sophonStore.ts:454-470` |
| SP-04 | Worker settings ingest | `src-tauri/scripts/sophon_runtime_worker.py` | `handle('add_source')` | settings persisted to source | same canonical model | FIXED | `sophon_runtime_worker.py:1087` |
| SP-05 | Enumerate branch | `src-tauri/scripts/sophon_runtime_worker.py` | `enumerate_files` mode detection | pre-fix: file path could be scanned as folder | file path must enumerate as file | FIXED | `sophon_runtime_worker.py:931-977` |

## Changes Applied (or none)
- None in this report section (analysis only). Actual code changes are documented in fix plan and test results reports.

## Re-test Results
- Post-fix reruns no longer fail with `No files matched...` for valid fixtures; failures move to downstream bridge init when dependencies are absent.

## Remaining Risks
- Existing saved sources with custom include restrictions can still intentionally filter files out.
- In environments missing NVIDIA bridge deps, ingestion fails after enumerate (expected downstream blocker).
