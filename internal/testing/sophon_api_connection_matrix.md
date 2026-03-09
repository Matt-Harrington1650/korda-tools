# SOPHON API Connection Matrix

## Definition of Done
- Enumerated SOPHON layer-to-layer connections.
- Executed direct runtime tests for reachable backend paths.
- Marked each connection PASS/FAIL/UNVERIFIED with root cause.

## User Goal / System Goal
- Every SOPHON action path should map to a live, correct, observable backend connection.

## Tests (steps + commands + expected result + actual result)
- Code contract mapping via `rg` and numbered file evidence.
- Runtime execution via `sophon_runtime_e2e_inprocess.py` and targeted probes.
- Backend dependency checks via Docker and health endpoints.

| Connection ID | Source Layer | Destination Layer | Trigger | Expected | Actual | Pass/Fail | Root Cause | Evidence |
| ------------- | ------------ | ----------------- | ------- | -------- | ------ | --------- | ---------- | -------- |
| C-01 | UI Router | SOPHON layout route | Navigate `/sophon` | Route exists | Route declared | Pass | None | `src/app/router.tsx:39-52` |
| C-02 | App shell nav | SOPHON route | Click Sophon nav item | Nav link wired | Link to `/sophon` exists | Pass | None | `src/app/AppShell.tsx:115-122` |
| C-03 | Zustand store | Runtime bridge | `runHealthCheck`, `addSource`, `queueIngestion`, `runRetrievalTest` | Store invokes bridge methods | Verified method calls | Pass | None | `src/features/sophon/store/sophonStore.ts:451-689` |
| C-04 | Runtime bridge | Tauri invoke | `sophonRuntimeInvoke()` | Calls `sophon_runtime_invoke` | Verified | Pass | None | `src/features/sophon/runtime/sophonRuntimeBridge.ts:14-19` |
| C-05 | Tauri invoke handler | Rust command | Command dispatch | Command registered | `sophon_runtime_invoke` registered | Pass | None | `src-tauri/src/lib.rs:137-149` |
| C-06 | Rust runtime manager | Python worker | `spawn_worker` and `ping` | Worker starts and responds | Worker started; ping succeeded in E2E | Pass | None | `src-tauri/src/sophon_runtime.rs:273-334`, `internal/testing/artifacts/sophon_e2e_raw.json` |
| C-07 | Worker readiness | Ingestor health API | `check_readiness` | Ingestor dependency pass | pass | Pass | None | `internal/testing/artifacts/sophon_e2e_raw.json`, `phase12_ingestor_health.json` |
| C-08 | Worker readiness | RAG health API | `check_readiness` | RAG dependency pass/warn surfaced | warn surfaced (reflection host missing) | Pass | Optional reflection endpoint unavailable | `internal/testing/artifacts/sophon_e2e_raw.json`, `phase12_rag_health.json` |
| C-09 | Worker queue path | NV ingest submit | `queue_ingestion` | Task created | task_id created; job set running | Pass | None | `internal/testing/artifacts/sophon_e2e_raw.json` |
| C-10 | Worker refresh loop | NV ingest task status | periodic `get_state` | Task progresses to terminal success/fail | stays pending until timeout fail | Fail | Backend task never leaves pending; timed out by guard | `internal/testing/artifacts/sophon_e2e_raw.json`, `sophon_runtime_worker.py:315-343` |
| C-11 | Worker retrieval path | RAG search | `run_retrieval_test` with no indexed source | No stale data retrieval | Returns explicit no-indexed-sources message, zero passages | Pass | Guard added | `internal/testing/artifacts/sophon_e2e_raw.json`, `sophon_runtime_worker.py:960-985` |
| C-12 | Worker retrieval path | NVIDIA embeddings endpoint | `run_retrieval_test` without API key | Graceful user-facing failure | Returns explicit no-enabled-sources message; no exception crash | Pass | Guard avoids backend exception path | `internal/testing/artifacts/sophon_no_api_key_probe.json` |
| C-13 | Source removal | Index cleanup/query isolation | `remove_source` then query | Removed source should not be queryable | Query blocked due no indexed sources; actual vector cleanup unverified | UNVERIFIED | No successful ingestion to validate cleanup | `internal/testing/artifacts/sophon_e2e_raw.json` |
| C-14 | Worker state persistence | Runtime state JSON | `get_state/save` | State durability | State persisted to profile json | Pass | None | `internal/testing/runtime_profile/sophon_runtime_state.json` |
| C-15 | SOPHON source state | Vector corpus isolation | Empty/failed source query behavior | Query should not leak unrelated corpus | Fixed post-patch; pre-patch leaked `LDRP.pdf` | Fail (pre-patch), Pass (post-patch mitigation) | Shared collection + missing queryability guard (now patched) | `internal/testing/artifacts/sophon_truth_query_raw.json`, `internal/testing/artifacts/sophon_e2e_raw.json` |
| C-16 | Local services | Network listeners | Runtime + docker stack up | Required ports/listeners active | Active listeners found for Milvus/Redis/RAG/Ingestor | Pass | None | `phase12_docker_ps.txt`, `phase12_netstat_ports.txt` |
| C-17 | UI feedback rendering | User-visible error states | Simulate ingestion/retrieval failures | Clear surfaced errors in UI | CLI/runtime evidence only; UI rendering not directly executed | UNVERIFIED | GUI session not automated in this run | `internal/testing/artifacts/command_logs/phase1_contract_extracts.txt` |

## Findings (severity-ranked P0/P1/P2/P3)
- P0: C-10 ingestion terminal success path is broken in this environment (pending forever without timeout guard).
- P1: C-15 showed stale corpus leakage before patch; mitigated by retrieval guard patch.
- P2: C-13 true delete/cleanup behavior remains unverified due inability to complete ingest.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- `src/features/sophon/runtime/sophonRuntimeBridge.ts:14-35`
- `src/features/sophon/store/sophonStore.ts:451-689`
- `src-tauri/src/lib.rs:137-149`
- `src-tauri/src/sophon_runtime.rs:273-298`
- `src-tauri/scripts/sophon_runtime_worker.py:315-356,899-922,960-985`
- `internal/testing/artifacts/sophon_e2e_raw.json`
- `internal/testing/artifacts/sophon_no_api_key_probe.json`

## Changes Applied (or none)
- Added env-overridable runtime timeouts and ingest pending timeout fail-fast.
- Added retrieval queryability guard and retrieval error logging path.

## Re-test Results
- Connection matrix improved on C-11/C-12/C-15 post patch.
- C-10 remains failing due upstream pending ingestion behavior.

## Remaining Risks
- Production correctness remains blocked until ingest can complete and queryable-source indexing is proven.
