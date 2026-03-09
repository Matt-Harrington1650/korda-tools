# SOPHON Truth Test Results

## Definition of Done
- Ran all required truth-set prompts against SOPHON runtime.
- Captured raw answers, passage counts, and source evidence.
- Scored correctness and pass/fail per test.

## User Goal / System Goal
- User can ask questions about uploaded Orion Tower seed knowledge and receive correct grounded answers.

## Tests (steps + commands + expected result + actual result)
- Step: Run full in-process E2E harness after patches.
- Command: `C:\code\ai-tool-hub\.sophon-py\Scripts\python.exe C:\code\ai-tool-hub\internal\testing\sophon_runtime_e2e_inprocess.py`
- Expected: Post-ingestion truth prompts answered from `sophon_test_knowledge.md`.
- Actual: Ingestion failed (pending timeout), and all queries returned "No enabled sources are indexed yet..." with zero passages.

| Test ID | Query | Expected | Actual | Citation Present | Correct | Pass/Fail | Severity | Evidence |
| ------- | ----- | -------- | ------ | ---------------- | ------- | --------- | -------- | -------- |
| TQ-01 | What is the building service size and voltage for Orion Tower Renovation? | 4000 A at 480Y/277 V, 3-phase, 4-wire | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |
| TQ-02 | What is ESB-1 rated for? | 1200 A at 480Y/277 V | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |
| TQ-03 | Which ATS serves life safety loads? | ATS-LS-1 | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |
| TQ-04 | What is the generator runtime basis? | 24 hours at calculated demand | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |
| TQ-05 | What is the lobby decorative lighting load allowance? | 1.8 W/sf | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |
| TQ-06 | Did Revision A change the open office target? | No, unchanged at 35 footcandles | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |
| TQ-07 | Which panel serves level 2 emergency lighting? | Panel EH-2 | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |
| TQ-08 | Who manufactures the generator? | Not provided in document | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |
| TQ-09 | What conduit size feeds MSB-1? | Not defined in document | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |
| TQ-10 | Summarize what the generator serves and what it does not serve. | Serves life safety + legally required standby + selected critical backup; does not serve normal HVAC | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |
| TQ-11 | Give me all short-circuit current values in this document. | Explicitly absent/not defined | No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying. | No | No | Fail | P0 | `internal/testing/artifacts/sophon_e2e_raw.json` |

## Findings (severity-ranked P0/P1/P2/P3)
- P0: Core RAG truth test failed 11/11 because ingestion never produced an indexed-ready source.
- P1: No citations are produced when ingestion fails, so user cannot verify claims.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- `internal/testing/artifacts/sophon_e2e_raw.json`: `initial_job_terminal.status=failed`, `truth_queries[*].passages=[]`.
- `internal/testing/artifacts/command_logs/phase8_truth_summary_after_patch.txt`: summarized truth run.
- `src-tauri/scripts/sophon_runtime_worker.py:315-356, 960-985`: ingestion timeout + retrieval guard logic.

## Changes Applied (or none)
- Applied retrieval guard and pending-timeout behavior before this truth retest.

## Re-test Results
- Retest completed with deterministic no-answer guard behavior instead of stale-corpus retrieval.

## Remaining Risks
- Until ingestion succeeds, truth/citation quality cannot be validated as correct for production.
