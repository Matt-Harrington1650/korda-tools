# SOPHON Patch Log

## Definition of Done
- Documented each applied code patch with safety rationale, validation, and rollback.

## User Goal / System Goal
- Ensure applied fixes are auditable and reversible.

## Tests (steps + commands + expected result + actual result)
- `python -m py_compile src-tauri/scripts/sophon_runtime_worker.py`
- `cargo check` (src-tauri)
- `python internal/testing/sophon_runtime_e2e_inprocess.py`
- no-key probe execution

## Findings (severity-ranked P0/P1/P2/P3)
- P1 fixes were applied for timeout reliability and retrieval trust behavior.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- `internal/testing/artifacts/command_logs/phase14_patch_diff.txt`
- `internal/testing/artifacts/command_logs/phase14_git_status_subset.txt`
- `src-tauri/src/sophon_runtime.rs:205-210,273-298`
- `src-tauri/scripts/sophon_runtime_worker.py:38-49,315-356,960-985`

## Changes Applied (or none)

| Patch ID | Repo | Finding IDs Addressed | Files Changed | Why this patch was safe | Validation Commands | Result | Rollback Path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SP-001 | ai-tool-hub | P1-bridge-timeout | `src-tauri/src/sophon_runtime.rs` | Env-driven defaults only; no API contract change | `cargo check` | PASS | `git checkout -- src-tauri/src/sophon_runtime.rs` |
| SP-002 | ai-tool-hub | P0/P1-ingest-stall | `src-tauri/scripts/sophon_runtime_worker.py` | Adds timeout fail-fast and task map cleanup; bounded to job polling path | `python -m py_compile ...`, E2E retest | PASS (deterministic fail message) | `git checkout -- src-tauri/scripts/sophon_runtime_worker.py` |
| SP-003 | ai-tool-hub | P1-trust-leakage + no-key handling | `src-tauri/scripts/sophon_runtime_worker.py` | Retrieval guard prevents ungrounded output when no queryable sources; error handling only in retrieval command path | E2E retest + no-key probe | PASS | `git checkout -- src-tauri/scripts/sophon_runtime_worker.py` |

## Re-test Results
- Runtime readiness bridge init now passes with new timeout defaults.
- Stuck ingestion now fails with explicit actionable reason instead of indefinite running.
- Retrieval now blocks with clear message when no indexed sources are queryable.

## Remaining Risks
- Upstream ingestion execution remains unresolved and still blocks successful index creation.
