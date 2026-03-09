# SOPHON Upload Flow Report

## Definition of Done
- Verified SOPHON upload/ingestion backend path execution with real seed file.
- Evaluated upload validation, duplicate behavior, and status state transitions.
- Documented what is verified vs unverified for UI-first upload interaction.

## User Goal / System Goal
- First-time user uploads a file, sees indexing progress, and can query once ready.

## Tests (steps + commands + expected result + actual result)
- Step: Add source for `sophon_test_knowledge.md` and queue ingestion.
- Command: `python internal/testing/sophon_runtime_e2e_inprocess.py`
- Expected: source added -> job progresses -> completed/indexed.
- Actual: source added, job submitted, task remained pending until timeout fail.
- Step: Unsupported file validation.
- Expected: clear validation failure and no partial indexing.
- Actual: deterministic failure message with no discovered files.
- Step: Duplicate upload test.
- Expected: dedupe or clear duplicate handling.
- Actual: second running job created (pending), dedupe not observed.

## Findings (severity-ranked P0/P1/P2/P3)
- P0: Upload/ingestion cannot complete in this environment (pending timeout).
- P1: Duplicate upload creates additional running job without dedupe resolution.
- P2: Actual click-path UX (drag-drop/file picker/progress UI) is UNVERIFIED in this headless run.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- `internal/testing/artifacts/sophon_e2e_raw.json`: `initial_job_terminal.status=failed`, timeout reason.
- `internal/testing/runtime_profile/sophon_runtime_state.json`: job states and failure reason persisted.
- `src-tauri/scripts/sophon_runtime_worker.py:885-922`: add source + queue ingestion.
- `internal/testing/artifacts/command_logs/phase8_truth_summary_after_patch.txt`: edge-case summary.

## Changes Applied (or none)
- Added pending-task timeout handling and explicit failure reason logging.

## Re-test Results
- Post-patch ingestion transitions to failed timeout deterministically (no indefinite hang).
- Core success path (completed indexing) still not achieved.

## Remaining Risks
- Without successful indexing, user cannot reach trustworthy query/citation workflow.
- UI affordance quality for upload/progress remains unverified pending interactive run.
