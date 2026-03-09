# SOPHON Trust Risk Map

## Definition of Done
- Ranked top trust risks impacting correctness, grounding, and user confidence.

## User Goal / System Goal
- SOPHON should never imply knowledge it cannot ground.

## Tests (steps + commands + expected result + actual result)
- Truth set executed post-patch.
- No-key failure probe executed.
- Pre-patch stale retrieval artifact reviewed for regression evidence.

## Findings (severity-ranked P0/P1/P2/P3)
1. P0: Core truth set fails when ingest pipeline does not complete.
2. P1: Pre-patch stale corpus leakage (retrieving `LDRP.pdf` for Orion seed questions).
3. P1: No successful citation path observed; trust verification blocked.
4. P1: Shared collection model can blur source provenance unless strictly gated.
5. P1: Duplicate pending tasks can make readiness appear active without progress.
6. P2: Readiness degraded/blocked states require clearer user guidance for next action.
7. P2: Optional reflection warnings can dilute critical blockers.
8. P2: Source delete cleanup path remains unverified.
9. P3: UI presentation of trust/citation evidence not directly validated here.
10. P3: External key dependencies can quietly shift behavior across sessions.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- `internal/testing/artifacts/sophon_truth_query_raw.json` (pre-patch stale retrieval)
- `internal/testing/artifacts/sophon_e2e_raw.json` (post-patch guarded responses)
- `internal/testing/artifacts/sophon_no_api_key_probe.json`
- `src-tauri/scripts/sophon_runtime_worker.py:960-985`

## Changes Applied (or none)
- Retrieval guard prevents ungrounded stale-corpus responses when no queryable source exists.

## Re-test Results
- Trust posture improved from misleading retrieval to explicit not-ready messaging.

## Remaining Risks
- Until successful ingest and grounded answers are proven, SOPHON remains NO-GO for trust-critical engineering Q&A.
