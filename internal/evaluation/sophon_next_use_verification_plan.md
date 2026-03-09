# Sophon Next-Use Verification Plan (Implemented)

## Objective
Provide a deterministic Two-Tier verification workflow so Sophon is validated before each use and deeply revalidated after changes or failures.

## Two-Tier Model
1. Tier 1 (every launch, ~3 minutes)
- Run quick preflight gates before normal usage.
- Enforce bridge readiness as a hard stop.

2. Tier 2 (change/failure, ~20-40 minutes)
- Run deep runtime, backend, intake, ingestion, retrieval, and persistence checks.

## Implemented Assets
- Automated verifier:
  - `internal/evaluation/scripts/sophon-verify-next-use.ps1`
- Tier 1 runbook:
  - `internal/evaluation/sophon_next_use_tier1_runbook.md`
- Tier 2 runbook:
  - `internal/evaluation/sophon_next_use_tier2_runbook.md`
- Machine-readable result artifact:
  - `internal/evaluation/artifacts/sophon_next_use_verify.latest.json`

## Runtime Policy Enforcement
- Canonical interpreter path:
  - `C:\code\ai-tool-hub\.sophon-py\Scripts\python.exe`
- User-scope policy variable checked:
  - `SOPHON_PYTHON_BIN`
- Bridge dependency imports validated from canonical venv:
  - `nvidia_rag`
  - `nv_ingest_client`
  - `nv_ingest_api`
  - `opentelemetry.instrumentation.fastapi`
  - `opentelemetry.instrumentation.milvus`

## Tier 1 Gates
- State source-of-truth path:
  - `%APPDATA%\com.mattharrington.kordatools\sophon_runtime_state.json`
- Required readiness checks:
  - `python_runtime=pass`
  - `torch_runtime=pass`
  - `bridge_init=pass`
  - `api_key=pass` when egress is enabled
- Worker interpreter policy:
  - Any `sophon_runtime_worker.py` process must use canonical interpreter.

## Tier 2 Gates
- Backend health endpoints:
  - `http://localhost:8082/v1/health?check_dependencies=true`
  - `http://localhost:8081/v1/health?check_dependencies=true`
- Intake glob edge-case validation:
  - Root-level + nested `**/*.pdf` matching.
- Additional state checks:
  - At least one source configured.
  - Snapshot presence warning for restore readiness.

## Severity and Decision Rules
- P0:
  - `bridge_init` failure
  - interpreter policy breach
  - backend unavailability for production path
- P1:
  - ingestion/retrieval degraded but recoverable
- Tier result:
  - `blocked` when any fail check exists
  - `warning` when no fails and at least one warning
  - `ready` when all checks pass

## Operator Commands
```powershell
cd C:\code\ai-tool-hub
powershell -ExecutionPolicy Bypass -File .\internal\evaluation\scripts\sophon-verify-next-use.ps1 -Tier tier1
powershell -ExecutionPolicy Bypass -File .\internal\evaluation\scripts\sophon-verify-next-use.ps1 -Tier tier2
```

## Notes
- If Tier 1 or Tier 2 reports `bridge_init` fail, stop normal usage and remediate dependencies first.
- If backend health checks fail, restore local Milvus/MinIO/Redis/NV-Ingest/RAG before intake/retrieval validation.
