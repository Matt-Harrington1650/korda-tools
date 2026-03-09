# SOPHON Re-test Results

## Definition of Done
- Re-ran impacted flows after each patch and captured outcomes.

## User Goal / System Goal
- Confirm patches improved behavior without regressions.

## Tests (steps + commands + expected result + actual result)
1. `python -m py_compile src-tauri/scripts/sophon_runtime_worker.py`
- Expected: syntax valid.
- Actual: pass.
2. `cargo check` in `src-tauri`
- Expected: compile success.
- Actual: pass.
3. `python internal/testing/sophon_runtime_e2e_inprocess.py`
- Expected: deterministic ingest terminal result and stable retrieval behavior.
- Actual: ingest terminal failed with timeout (explicit); truth queries returned guarded not-indexed message.
4. no-key probe
- Expected: no crash/unhandled retrieval exception.
- Actual: readiness blocked + safe retrieval message.

## Findings (severity-ranked P0/P1/P2/P3)
- P0 remains: ingest pipeline does not complete.
- P1 fixed: stale-corpus retrieval when no indexed sources.
- P1 fixed: hardcoded bridge init timeout fragility.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- `internal/testing/artifacts/sophon_e2e_raw.json`
- `internal/testing/artifacts/sophon_no_api_key_probe.json`
- `internal/testing/artifacts/command_logs/phase8_truth_summary_after_patch.txt`
- `src-tauri/src/sophon_runtime.rs:273-298`
- `src-tauri/scripts/sophon_runtime_worker.py:315-343,965-985`

## Changes Applied (or none)
- Re-test only (changes logged in `sophon_patch_log.md`).

## Re-test Results
- PASS: compile checks.
- PASS: readiness bridge initialization path.
- PASS: retrieval guard and no-key graceful path.
- FAIL: ingestion completion.

## Remaining Risks
- Production SOPHON usage remains constrained by unresolved ingestion execution defect.
