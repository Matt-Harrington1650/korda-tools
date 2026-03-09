# Sophon Operations

## Where Sophon Runs
Sophon runs inside your existing **KORDA TOOLS** desktop app (`C:\code\ai-tool-hub`).

No separate web admin is required and no Sophon localhost UI endpoint is used.

## Information Architecture
Inside KORDA TOOLS:
1. Dashboard
2. Sources
3. Ingestion Jobs
4. Index
5. Retrieval Lab
6. Models & Tuning
7. Policies & Audit
8. Backup/Restore
9. Settings

## Daily Operator Procedure
1. Open KORDA TOOLS and go to `Sophon -> Settings`.
2. Enter your NVIDIA API key (`nvapi-...`) and click `Save Key`.
3. Click `Run Readiness Check` and resolve any blockers shown under `Enterprise Readiness`.
4. If blockers remain, click `Auto Remediate`, then run readiness again.
5. Go to `Sophon -> Dashboard` and confirm runtime status is `running` or `degraded` with no blockers.
6. Go to `Sophon -> Sources`, add or update sources.
7. Queue ingestion jobs (optional: dry-run and safe-mode).
8. Monitor stage progression and checkpoints in `Sophon -> Ingestion Jobs`.
9. Validate and tune index controls in `Sophon -> Index`.
10. Run retrieval sanity checks in `Sophon -> Retrieval Lab`.
11. Review policy and audit evidence in `Sophon -> Policies & Audit`.
12. Export backup and logs in `Sophon -> Backup/Restore`.

## Enterprise Readiness (Settings)
Readiness checks validate:
- NVIDIA API key availability (if hosted inference egress is enabled).
- Sophon NVIDIA bridge initialization.
- Local ingestion prerequisites (Milvus, object storage, NV-Ingest, Redis) via dependency health.
- Retrieval prerequisites via RAG dependency health.
- Default collection bootstrap availability.
- Source configuration status.

If runtime shows degraded:
- Open `Sophon -> Settings`.
- Run `Run Readiness Check`.
- Follow the remediation steps listed for failed checks.
- For full ingest + retrieve, local RAG dependencies must be reachable.

## Ingestion Job Controls
- Queue: from Sources.
- Pause/Resume/Cancel/Retry: from Ingestion Jobs.
- Stage tracking: per-job stage cards and progress bars.
- Validation summary: shown on failed or invalid jobs.

## Backup/Restore
1. Open `Sophon -> Backup/Restore`.
2. Click `Export Backup`.
3. Click `Validate Import (Dry-Run)` before restore.
4. Click `Restore Backup` when dry-run passes.
5. Export `Logs` for evidence bundles.

## Offline Gate Verification
1. Open `Sophon -> Policies & Audit`.
2. Click `Simulate blocked egress event`.
3. Confirm a new blocked egress evidence record appears.

## Troubleshooting
- Runtime degraded with blockers:
  - Open `Sophon -> Settings -> Enterprise Readiness`.
  - Run readiness check and apply the remediation guidance.
  - Confirm local Milvus/ingestion prerequisites are reachable.
- Runtime not progressing jobs:
  - Ensure runtime status is `running`.
  - Check `Models & Tuning -> Max Ingestion Workers`.
- Retrieval has no passages:
  - Verify at least one ingestion job completed.
- Index integrity degraded:
  - Run `Index -> Validate Index`, inspect failed jobs, retry.
- Restore failure:
  - Validate payload with dry-run and confirm schema compatibility.
