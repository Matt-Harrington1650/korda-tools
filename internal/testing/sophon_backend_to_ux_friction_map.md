# SOPHON Backend-to-UX Friction Map

## Definition of Done
- Mapped backend failures to direct UX pain points and patch targets.

## User Goal / System Goal
- Backend state should be reflected as clear, actionable UX feedback.

## Tests (steps + commands + expected result + actual result)
- Correlated E2E runtime outputs with backend/state code paths.

## Findings (severity-ranked P0/P1/P2/P3)
1. P0: Pending ingest tasks => user never reaches query-ready state. Patch target: `src-tauri/scripts/sophon_runtime_worker.py:315-343`.
2. P1: Unscoped retrieval against shared collection => wrong source risk. Patch target: `src-tauri/scripts/sophon_runtime_worker.py:965-985` (now mitigated).
3. P1: Hardcoded short bridge timeout => false blocked readiness. Patch target: `src-tauri/src/sophon_runtime.rs:273-298` (fixed).
4. P1: Missing deterministic terminal outcome for long tasks => confusing spinner states.
5. P1: Duplicate queueing without dedupe => user sees multiple running jobs with no progress.
6. P2: Optional dependency warnings mixed with blockers => noisy UX diagnostics.
7. P2: State source/index mismatch (`source_setup` warn + nonzero index) => trust confusion.
8. P2: Removal/cleanup verification gap => uncertain post-delete behavior.
9. P2: No GUI-verified progress microcopy in this run => user guidance quality unproven.
10. P3: Multi-page SOPHON IA may require onboarding affordance for first run.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- `src-tauri/src/sophon_runtime.rs:273-298`
- `src-tauri/scripts/sophon_runtime_worker.py:315-343,965-985`
- `internal/testing/artifacts/sophon_e2e_raw.json`
- `internal/testing/runtime_profile/sophon_runtime_state.json`

## Changes Applied (or none)
- Applied timeout and retrieval guard patches as above.

## Re-test Results
- Backend-caused misleading answer behavior reduced.
- Backend ingest execution defect still blocks end-user success.

## Remaining Risks
- UX remains constrained by unresolved upstream NV ingest task progression.
