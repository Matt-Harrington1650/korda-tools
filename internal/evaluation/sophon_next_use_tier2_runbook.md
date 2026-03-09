# Sophon Tier 2 Deep Verification Runbook (On Change/Failure)

## Goal
Run full end-to-end verification when environment changes or Tier 1 fails.

## Duration
- Target: 20 to 40 minutes

## Trigger Conditions
- Tier 1 `bridge_init` failure.
- Python dependency changes.
- KORDA-RAG or Sophon runtime updates.
- Docker/WSL/backend stack changes.
- Repeated ingestion or retrieval failures.

## Phase A: Runtime Dependency Audit
1. Verify canonical interpreter:
```powershell
cd C:\code\ai-tool-hub
[Environment]::GetEnvironmentVariable("SOPHON_PYTHON_BIN","User")
```
2. Verify bridge imports in canonical venv:
```powershell
$py = "C:\code\ai-tool-hub\.sophon-py\Scripts\python.exe"
& $py -c "import nvidia_rag, nv_ingest_client, nv_ingest_api, opentelemetry.instrumentation.fastapi, opentelemetry.instrumentation.milvus; print('imports_ok')"
```
3. Ensure worker process path is canonical while app is open:
```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -match "sophon_runtime_worker.py" } |
  Select-Object ProcessId, ExecutablePath, CommandLine
```
- Fail if any worker `ExecutablePath` is not `C:\code\ai-tool-hub\.sophon-py\Scripts\python.exe`.

## Phase B: Backend Service Audit
1. Validate ingestor and rag health:
```powershell
curl.exe "http://localhost:8082/v1/health?check_dependencies=true"
curl.exe "http://localhost:8081/v1/health?check_dependencies=true"
```
2. If down, validate Docker stack from WSL:
```powershell
wsl -d Ubuntu -- bash -lc "cd /mnt/c/code/KORDA-RAG && docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```
3. Recover stack as needed before continuing.

## Phase C: Intake UX Audit
1. Source form validation:
- Required field enforcement (`name`, `path`).
- Duplicate source rejection.
- Extension parsing from `.pdf,.docx` and `pdf,docx`.
2. File matching edge case:
- Source folder with root-level PDF and nested PDF.
- Include patterns supporting both root and nested matches.
- Confirm no false no-match failure.

## Phase D: Ingestion Lifecycle Audit
1. Queue ingestion.
2. Verify stage progression and terminal state.
3. Verify controls:
- Pause only while running.
- Resume only while paused.
- Cancel only for active jobs.
- Retry only for failed/cancelled jobs.
4. Verify failure reason quality for no-match and dependency failures.

## Phase E: Retrieval and Index Audit
1. Retrieval:
- Run query and confirm answer with passages/scores.
2. Index:
- Validate index.
- Create snapshot.
- Restore snapshot.
- Publish snapshot.
3. Verify export outputs:
- Retrieval JSON report.
- Retrieval text report.

## Phase F: Persistence Audit
1. Restart KORDA TOOLS.
2. Confirm continuity:
- Sources persisted.
- Job history persisted.
- Readiness state reloaded from canonical APPDATA path.

## Automated Tier 2 Command
Run consolidated verifier:
```powershell
cd C:\code\ai-tool-hub
powershell -ExecutionPolicy Bypass -File .\internal\evaluation\scripts\sophon-verify-next-use.ps1 -Tier tier2
```

## Artifacts
- Machine-readable summary:
`internal/evaluation/artifacts/sophon_next_use_verify.latest.json`

## Pass Criteria
- No fail checks in Tier 2 verifier.
- Backend health endpoints healthy.
- Ingestion and retrieval end-to-end path succeeds.

## Severity Policy
- P0: `bridge_init` failure, interpreter policy breach, backend unavailable for production path.
- P1: Ingestion/retrieval path degraded but recoverable with operator intervention.
- P2: UX friction without functional break.
