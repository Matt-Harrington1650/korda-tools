# Sophon Tier 1 Preflight Runbook (Every Launch)

## Goal
Run a fast verification before each Sophon session so usage starts from a known-good state.

## Duration
- Target: 3 minutes

## Preconditions
- KORDA TOOLS desktop app is installed.
- Canonical Sophon venv exists at `C:\code\ai-tool-hub\.sophon-py`.
- Canonical venv has bridge imports available:
  - `nvidia_rag`
  - `nv_ingest_client`
  - `nv_ingest_api`
  - `opentelemetry.instrumentation.fastapi`
  - `opentelemetry.instrumentation.milvus`

## Step-by-Step
1. Open KORDA TOOLS.
2. Go to `Sophon -> Settings`.
3. Click `Run Readiness Check`.
4. Confirm required checks:
- `python_runtime = pass`
- `torch_runtime = pass`
- `api_key = pass` when egress is enabled
- `bridge_init = pass` (hard gate)
5. In PowerShell, run:
```powershell
cd C:\code\ai-tool-hub
powershell -ExecutionPolicy Bypass -File .\internal\evaluation\scripts\sophon-verify-next-use.ps1 -Tier tier1
```
6. Confirm verifier summary:
- `overallStatus` is `ready` or `warning` only for non-blocking conditions.
- `bridge_init` is not failing.
7. Confirm state source of truth:
- `%APPDATA%\com.mattharrington.kordatools\sophon_runtime_state.json`
8. Run one smoke ingestion action:
- `Sophon -> Sources` add/select source.
- Queue one minimal ingestion run or dry-run.
- Confirm job enters queued/running/completed path.
9. Run one smoke retrieval action:
- `Sophon -> Retrieval Lab -> Run Test`.
- Confirm answer object returns.
- Confirm `Export Report` and `Export Text` both work.

## Pass Criteria
- No Tier 1 fail checks.
- `bridge_init = pass`.
- One ingestion smoke + one retrieval smoke succeeds.

## Fail Handling
- If `bridge_init` fails: stop usage and run Tier 2.
- If backend health fails: run Tier 2 Phase B and recover stack before usage.
