# Cross-Repo Risks and Recommendations (KORDA TOOLS <-> KORDA-RAG)

## Executive findings
- CR-001 confirmed: KORDA TOOLS (desktop-local runtime) and KORDA-RAG (service-first runtime) are architecturally mismatched by default.
- CR-002 confirmed: offline objective conflicts with multiple default HTTP/cloud/service endpoint assumptions in KORDA-RAG.
- CR-003 resolved with constraints: no-bind in-process smoke path exists and runs, but it is not yet a complete no-service production mode.
- CR-004 confirmed: observability and runtime dependency models differ materially (OpenTelemetry/runtime dependencies and service health assumptions).
- KORDA-RAG compose prompt mount issue was fixed; this removed a real Windows bootstrap blocker.
- KORDA TOOLS hardening wave completed (CSP, logging, panic path, typecheck, metadata) with passing retests.
- Embedding decision: **Go-with-constraints for experimental in-process calls; No-Go for production direct embedding without HTTP/microservice assumptions**.

## Phase 0 — Environment and identity
### Definition of Done
- Repo locations, remotes, heads, branches, and variant drift were proven.

### Tests (commands run + results)
- Environment version commands and repo status commands executed.
- `korda-tools` vs `ai-tool-hub` identity comparisons run with hash and targeted diffs.

### Findings (severity-ranked: P0/P1/P2/P3)
- P2 CR-001 precursor confirmed: `ai-tool-hub` is a divergent variant with large local modifications, increasing integration risk.

### Evidence (file paths + line ranges + short snippets + command output summary)
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_environment_versions_final.log:3-65`.
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_identity_table_raw.txt:3-25`.
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_common_file_sample_hashes.txt:6-20`.
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\final_repo_status_and_diffs.log:1-12,215-260`.

### Changes Applied
- None.

### Re-test Results
- N/A.

### Remaining Blockers
- Variant drift requires disciplined commit sequencing to avoid accidental regression transfer.

## Phase 1 — Automated health and first patch wave
### Definition of Done
- Both repos validated and first remediation wave applied.

### Tests (commands run + results)
- KORDA TOOLS/variant: full frontend + Rust + audit runs.
- KORDA-RAG: lint/test/audit/config discovery runs.

### Findings (severity-ranked: P0/P1/P2/P3)
- P1 CR-004 confirmed: runtime dependency drift is real (bridge/telemetry dependency chain sensitivity).
- P1 CR-001 confirmed: KORDA-RAG local validation depends on environment discipline and service assumptions.

### Evidence (file paths + line ranges + short snippets + command output summary)
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\final_command_output_summaries.log:715-728` (pip-audit OK, root compose file absent).
- `...\final_command_output_summaries.log:663-713` (`pytest` collection errors in local setup).
- `...\final_command_output_summaries.log:912-920` (telemetry dependency remediation path).

### Changes Applied
- KORDA TOOLS hardening and KORDA-RAG compose prompt mount fix.

### Re-test Results
- KORDA TOOLS retests green (warnings only).
- KORDA-RAG compose config retests green for mount rendering.

### Remaining Blockers
- KORDA-RAG full local test/lint reproducibility remains unresolved.

## Phase 2 — Architecture and boundaries
### Definition of Done
- Cross-repo runtime model deltas proven from code and config.

### Tests (commands run + results)
- Static scans on entrypoints, HTTP calls, service deps, config defaults.

### Findings (severity-ranked: P0/P1/P2/P3)
- P0 CR-001 CONFIRMED: model mismatch desktop IPC/local host vs service mesh assumptions.
- P0 CR-002 CONFIRMED: offline-first objective conflicts with endpoint/cloud defaults.

### Evidence (file paths + line ranges + short snippets + command output summary)
- Service bind defaults:
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml:14`.
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-ingestor-server.yaml:14`.
- Endpoint defaults:
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml:34,124,218-220,277-291`.
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-ingestor-server.yaml:33,111,213,223,234,240,246,249`.
  - `C:\code\KORDA-RAG\src\nvidia_rag\utils\configuration.py:133-135,466,655,690`.

### Changes Applied
- None in this phase.

### Re-test Results
- N/A.

### Remaining Blockers
- Strict offline direct embedding still blocked by default architecture.

## Phase 3 — Critical surfaces and hardening
### Definition of Done
- High-confidence mechanical fixes applied where safe across repos.

### Tests (commands run + results)
- Re-ran lint/test/build/clippy and compose config validations.

### Findings (severity-ranked: P0/P1/P2/P3)
- P1 CR-004 CONFIRMED: operational dependency chain is broad (OpenTelemetry + service clients + external config).
- P2 cross-operational risk reduced by compose mount fix and desktop hardening wave.

### Evidence (file paths + line ranges + short snippets + command output summary)
- KORDA TOOLS hardening code references:
  - `C:\code\korda-tools\src-tauri\tauri.conf.json:23`
  - `C:\code\korda-tools\src-tauri\src\lib.rs:129-132,142`
  - `C:\code\korda-tools\package.json:9`
- KORDA-RAG compose fix references:
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml:17,24`
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-ingestor-server.yaml:18,28`
- Post-fix compose config evidence:
  - `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\retest_korda_rag_compose_rag_config.log:69-78`
  - `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\retest_korda_rag_compose_ingestor_config.log:69-78`

### Changes Applied
- Yes (documented in `internal/remediation/patch_log.md`).

### Re-test Results
- Green for patched mechanical scope.

### Remaining Blockers
- Full no-service integration behavior remains unresolved.

## Phase 4 — Embedding feasibility and smoke
### Definition of Done
- No-bind in-process smoke attempted and decision-ready evidence captured.

### Tests (commands run + results)
- Executed `integration_smoke.py` against local source imports.
- Captured port deltas and smoke responses.

### Findings (severity-ranked: P0/P1/P2/P3)
- P1 CR-003 DISPROVEN (as “not yet proven”): no-bind path exists and runs.
- P0 CR-001/CR-002 still confirmed at production level: no-service parity is not achieved.

### Evidence (file paths + line ranges + short snippets + command output summary)
- `C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py:16-18,140-193`.
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase4_integration_smoke.log:970-984`:
  - `"new_listening_ports": []`
  - in-process health/search/ingest smoke payload.

### Changes Applied
- Added smoke harness and telemetry dependency remediation in canonical Sophon interpreter.

### Re-test Results
- Smoke completed without opening listeners.

### Remaining Blockers
- End-to-end production ingest/query without external service assumptions is not proven.

## Phase 5 — Cross-repo baseline and commit sequence
### Definition of Done
- Cross-repo release recommendation and ordered remediation sequence documented.

### Tests (commands run + results)
- Consolidated from phases 0-4.

### Findings (severity-ranked: P0/P1/P2/P3)
- P0: Direct embedding without HTTP/microservice assumptions is not production-ready.
- P1: dependency/reproducibility and observability mismatches remain.

### Evidence (file paths + line ranges + short snippets + command output summary)
- See `internal/remediation/commit_sequence.md` and `internal/evaluation/evidence_index.md`.

### Changes Applied
- Documentation only.

### Re-test Results
- N/A.

### Remaining Blockers
- Requires targeted architecture work (offline profile, bounded adapters, fail-fast guards).

## Decision: embedding feasibility
- **Direct embedding of KORDA-RAG into KORDA TOOLS without HTTP/microservice assumptions:** **No-Go**.
- **Go-with-constraints path (experimental):** in-process no-bind calls are feasible for limited operations using current library APIs, with explicit dependency/profile constraints and without claiming production no-service parity.

## Recommended remaining patch plan (ordered)
1. Introduce explicit offline-only profile in KORDA-RAG that disables all remote/service URL defaults and fails closed on unavailable mandatory stores.
2. Add a bounded adapter layer for KORDA TOOLS that calls only vetted library-mode APIs and blocks server-mode entrypoints.
3. Harden dependency reproducibility for KORDA-RAG (single authoritative lock strategy per runtime path).
4. Add minimal cross-repo integration test job that executes `integration_smoke.py` in CI-like environment.

## Go/No-Go for production readiness
- Cross-repo production embedding objective (strict no HTTP/microservice assumptions): **No-Go**.

## Appendix: commands run + output summaries
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_environment_versions_final.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\final_command_output_summaries.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\retest_korda_rag_compose_rag_config.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\retest_korda_rag_compose_ingestor_config.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase4_integration_smoke.log`
