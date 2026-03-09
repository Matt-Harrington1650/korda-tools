# SOPHON Failure and Recovery Report

## Definition of Done
- Executed edge/failure scenarios and documented behavior, state integrity, and recovery signals.

## User Goal / System Goal
- SOPHON should fail clearly, preserve consistent state, and provide recovery direction.

## Tests (steps + commands + expected result + actual result)
- Duplicate upload: queued same source twice in E2E harness.
- Unsupported file type: source include/extensions intentionally mismatched.
- No-model/no-key: ran probe with API key env vars cleared.
- Partial indexing interruption surrogate: pending task forced to timeout via guard.
- No-results behavior: truth queries after failed ingestion.
- Delete source: remove source then query.

## Findings (severity-ranked P0/P1/P2/P3)
- P0: Core ingestion repeatedly remains pending; recovery requires backend task execution fix.
- P1: Duplicate upload created additional running/pending job (no dedupe guard observed).
- P1: No-key path now degrades safely (post patch), but still blocked for actual retrieval.
- P2: Delete-source physical vector cleanup remains unverified.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- `internal/testing/artifacts/sophon_e2e_raw.json` (`edge_cases`, `initial_job_terminal`).
- `internal/testing/artifacts/sophon_no_api_key_probe.json` (blocked readiness + safe query response).
- `internal/testing/runtime_profile/sophon_runtime_state.json` (ingestion timeout log persisted).
- `src-tauri/scripts/sophon_runtime_worker.py:316-343,960-985`.

## Changes Applied (or none)
- Added deterministic timeout fail for stuck ingest tasks.
- Added retrieval readiness gating and safe error response path.

## Re-test Results
- Failure modes now surface explicit, actionable messages.
- Recovery still constrained by unresolved upstream pending ingest execution.

## Remaining Risks
- Production recovery remains weak for duplicate-running job reconciliation.
- Successful resume/retry-to-completion path remains unproven.
