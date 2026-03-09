# Sophon Ingestion Smoke Results

## Executive Findings
- Real ingestion job creation now advances past enumerate with matched files (`discoveredFiles > 0`).
- Previous failure signature (`No files matched source settings`) is no longer present for valid repro fixtures.
- Current blocker is downstream bridge dependency (`No module named 'nv_ingest_client'`), not enumerate.

## Definition of Done
- At least one real ingestion smoke demonstrates enumerate stage success for valid files.

## Goal
- Prove repaired enumerate behavior in runtime job flow (not only unit tests).

## Tests (commands run + expected result + actual result)
1. `python internal/testing/ingestion_smoke_post_fix.py`
- Expected: source with mixed supported files should match >0 files and not fail on enumerate.
- Actual: `discoveredFiles: 7`, failure moved to bridge init (`nv_ingest_client` missing).

2. `python internal/testing/ingestion_smoke_file_mode_post_fix.py`
- Expected: direct file path configured as folder should still enumerate file.
- Actual: `discoveredFiles: 1`, `resolvedSourceMode: file`, failure moved to bridge init.

## Findings (severity-ranked P0/P1/P2/P3)
- P0 fixed: enumerate no longer blocks valid supported files in tested scenarios.
- P1: downstream NVIDIA bridge dependency still blocks full ingest completion in this environment.
- P2: temporary smoke scripts/state were created under `internal/testing` for reproducibility.

## Evidence (file paths + line ranges + command output + logs + DB/state evidence)
- Smoke output summary (folder fixture):
  - `jobId=job-57bc2f1a-5a7d-4544-b655-a14520eae39d`
  - `status=failed`, `discoveredFiles=7`
  - `failureReason=NVIDIA bridge init failed: No module named 'nv_ingest_client'`
  - `enumerateDiagnostics.matchedFileCount=7`
- Smoke output summary (file-mode autodetect fixture):
  - `jobId=job-3f3cad16-0b99-4220-87e6-2dd22c1bf725`
  - `status=failed`, `discoveredFiles=1`
  - `resolvedSourceMode=file`
- Worker stage logic evidence: `C:\code\ai-tool-hub\src-tauri\scripts\sophon_runtime_worker.py:1104-1124`.

### Smoke Results Table
| Test ID | Source Type | Files Present | Expected Enumerate Result | Actual Result | Pass/Fail | Severity | Evidence |
|---|---|---|---|---|---|---|---|
| SMK-01 | Folder (legacy include + full allowed) | `pdf/docx/md/dwg/xlsx/csv/jpg` + unsupported `.exe` | match supported files, reject unsupported | `candidate=8`, `matched=7`, bridge failure after enumerate | PASS | P1 (downstream) | `ingestion_smoke_post_fix.py` output; `enumerateDiagnostics` |
| SMK-02 | File path with `sourceType=folder` | `sample.md` | auto-resolve file mode and match one | `discoveredFiles=1`, `resolvedSourceMode=file`, bridge failure after enumerate | PASS | P1 (downstream) | `ingestion_smoke_file_mode_post_fix.py` output |

## Changes Applied (or none)
- None in smoke phase; this phase validated the patched worker.

## Re-test Results
- Smoke re-runs consistently bypass enumerate failure and fail only at missing bridge dependency.

## Remaining Risks
- Full ingest completion requires resolving bridge dependency/runtime environment (`nv_ingest_client` and related stack).
