# Sophon Ingestion File Detection Fix Plan

## Executive Findings
- Chosen repair model: Hybrid (direct-file bypass + directory glob/extension filtering + legacy include auto-expansion for compatibility).
- Canonical extension set is centralized in worker defaults to remove silent drift.
- Enumerate diagnostics now provide source mode, candidate counts, rejection counts, and sample rejected paths.

## Definition of Done
- Root-cause repair is implemented in worker enumerate logic.
- Include/allowed contradiction path is handled safely.

## Goal
- Apply minimal, bounded fixes that make enumerate robust on Windows paths and mixed source settings.

## Tests (commands run + expected result + actual result)
1. `rg -n -S "def enumerate_files|autoExpandedIncludeExtensions|enumerateDiagnostics" src-tauri/scripts/sophon_runtime_worker.py`
- Expected: confirm repaired paths and diagnostics.
- Actual: new enumerate pipeline and diagnostics fields confirmed.

2. `rg -n -S "useState('\*\*/\*')" src/pages/sophon/SophonSourcesPage.tsx`
- Expected: UI default should not narrow supported types.
- Actual: include default is now `**/*`.

## Findings (severity-ranked P0/P1/P2/P3)
- P0 fixed: direct-file selection now works even when source type is set to `folder`.
- P1 fixed: legacy include subset is auto-expanded when broader allowed extensions are configured.
- P2 fixed: failure reasons now include actionable diagnostics.

## Evidence (file paths + line ranges + command output + logs + DB/state evidence)
- Canonical supported extensions and legacy compatibility: `C:\code\ai-tool-hub\src-tauri\scripts\sophon_runtime_worker.py:23-46`.
- Pattern normalization/parsing helpers: `C:\code\ai-tool-hub\src-tauri\scripts\sophon_runtime_worker.py:168-204`.
- Repaired enumerate decision path: `C:\code\ai-tool-hub\src-tauri\scripts\sophon_runtime_worker.py:931-1043`.
- Queue failure diagnostics upgrade: `C:\code\ai-tool-hub\src-tauri\scripts\sophon_runtime_worker.py:1104-1121`.
- Worker add_source default extensions aligned with canonical set: `C:\code\ai-tool-hub\src-tauri\scripts\sophon_runtime_worker.py:1087`.
- UI default include pattern made broad: `C:\code\ai-tool-hub\src\pages\sophon\SophonSourcesPage.tsx:14`.

### Enumerate-Stage Matching Trace
| Match Step ID | Stage Step | Input | Expected | Actual | Pass/Fail | Root Cause | Evidence |
|---|---|---|---|---|---|---|---|
| EM-01 | Resolve source mode | `sourceType=folder`, path points to file | treat as file | now resolves `file` via `path.is_file()` | PASS | pre-fix path-mode coupling | `sophon_runtime_worker.py:946-977` |
| EM-02 | Candidate discovery | file path input | one candidate | one candidate discovered | PASS | pre-fix used `rglob` on file path | `sophon_runtime_worker.py:969-977` |
| EM-03 | Include filter (folder mode) | legacy include + full allowed set | no false-negative for allowed exts | missing ext globs auto-added | PASS | include/allowed drift | `sophon_runtime_worker.py:955-967` |
| EM-04 | Extension filter | uppercase extensions | case-insensitive acceptance | `.DWG/.JPG/.PNG/...` accepted via normalized suffix | PASS | case-normalization gap risk | `sophon_runtime_worker.py:940-944,1003-1006` |
| EM-05 | Failure diagnostics | zero-match case | actionable rejection reasons | now includes mode, counts, samples | PASS | opaque legacy error | `sophon_runtime_worker.py:1110-1121` |

## Changes Applied (or none)
- `src-tauri/scripts/sophon_runtime_worker.py`
  - Added canonical extension constants.
  - Added glob normalization/splitting helpers.
  - Added `enumerate_files()` with explicit mode resolution and detailed diagnostics.
  - Kept `list_files()` as wrapper for compatibility.
  - Updated `add_source` default `allowedExtensions` to canonical list.
  - Upgraded `queue_ingestion` failure message and persisted diagnostics.
- `src/pages/sophon/SophonSourcesPage.tsx`
  - Changed default include patterns from narrow subset to `**/*`.

## Re-test Results
- Unit tests and smoke runs show enumerate now returns matches for valid supported files and fails later (bridge init) when runtime dependencies are missing.

## Remaining Risks
- If users intentionally create restrictive include globs, zero-match is still valid behavior.
- Legacy auto-expansion is intentionally compatibility-scoped; future UX should expose this behavior in source settings help text.
