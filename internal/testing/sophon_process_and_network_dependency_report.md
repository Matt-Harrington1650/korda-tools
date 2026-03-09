# SOPHON Process and Network Dependency Report

## Definition of Done
- Identified local processes/listeners and network dependencies required by SOPHON runtime path.
- Tested dependency health and no-key failure behavior.

## User Goal / System Goal
- Users should understand what must run locally and what external dependencies are required.

## Tests (steps + commands + expected result + actual result)
- `docker ps --format ...`
- `curl http://localhost:8082/v1/health?check_dependencies=true`
- `curl http://localhost:8081/v1/health?check_dependencies=true`
- `netstat -ano | findstr ...`
- No-key probe for hosted inference path.

## Findings (severity-ranked P0/P1/P2/P3)
- P0: SOPHON ingest/query workflow is blocked when NV ingest tasks remain pending.
- P1: Hosted inference path depends on NVIDIA API key; without key, readiness is blocked for retrieval.
- P1: Runtime depends on local service mesh (Milvus/MinIO/Redis/ingestor/rag) for full path.
- P2: Reflection dependency warning (`nim-llm:8000`) appears optional but noisy.

## Evidence (file paths + line ranges + logs + screenshots + command output + DB evidence)
- `internal/testing/artifacts/command_logs/phase12_docker_ps.txt`
- `internal/testing/artifacts/command_logs/phase12_ingestor_health.json`
- `internal/testing/artifacts/command_logs/phase12_rag_health.json`
- `internal/testing/artifacts/command_logs/phase12_netstat_ports.txt`
- `internal/testing/artifacts/sophon_no_api_key_probe.json`
- `src-tauri/src/sophon_runtime.rs:273-310`

## Changes Applied (or none)
- Runtime now passes configurable timeout env vars to worker.

## Re-test Results
- Dependency health endpoints reachable.
- No-key scenario now returns safe non-crashing retrieval message.

## Remaining Risks
- Offline-first claim is constrained: retrieval path still requires hosted model key unless alternate local model path is configured.
- External dependency readiness can degrade independently of UI state without stronger user-facing diagnostics.
