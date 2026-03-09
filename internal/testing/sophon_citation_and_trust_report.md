# SOPHON Citation and Trust Report

## Definition of Done
- Evaluated citation visibility and grounding behavior under current runtime outcomes.
- Tested unsupported-answer behavior and trust messaging paths.
- Traced citation-related backend behavior from retrieval path.

## User Goal / System Goal
- Users should see grounded, traceable answers or explicit uncertainty/limits.

## Tests (steps + commands + expected result + actual result)
- Command: `python internal/testing/sophon_runtime_e2e_inprocess.py`
- Tested required unsupported questions (manufacturer, conduit size, short-circuit values) from truth set.
- Expected: grounded answers with citations when data exists; explicit refusal/absence when not.
- Actual: ingestion failure prevented citation generation; responses now clearly state "No enabled sources are indexed yet...".

## Findings (severity-ranked P0/P1/P2/P3)
- P0: No citation-capable answer path executed because ingestion never reached indexed-ready state.
- P1: Prior to patch, retrieval surfaced unrelated `LDRP.pdf` passages (trust failure); mitigated by queryability guard.
- P2: UI rendering of citation chips/links remains UNVERIFIED in this run.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- Pre-patch stale retrieval evidence: `internal/testing/artifacts/sophon_truth_query_raw.json` (passages from `LDRP.pdf`).
- Post-patch guarded behavior: `internal/testing/artifacts/sophon_e2e_raw.json` (`passages=[]`, no-indexed-sources answer).
- Retrieval logic: `src-tauri/scripts/sophon_runtime_worker.py:960-985`.

## Changes Applied (or none)
- Added retrieval guard requiring enabled + completed indexed sources.
- Added graceful retrieval failure messaging/logging path.

## Re-test Results
- Trust behavior improved: no stale-corpus leakage when ingestion is not ready.
- Citation UX still blocked by ingest failure.

## Remaining Risks
- Cannot assert citation correctness for engineering usage until successful ingest/query cycle is achieved.
