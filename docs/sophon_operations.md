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
1. Open KORDA TOOLS and go to `Sophon -> Dashboard`.
2. Click `Start`, then `Refresh`.
3. Go to `Sophon -> Sources`, add or update sources.
4. Queue ingestion jobs (optional: dry-run and safe-mode).
5. Monitor stage progression and checkpoints in `Sophon -> Ingestion Jobs`.
6. Validate and tune index controls in `Sophon -> Index`.
7. Run retrieval sanity checks in `Sophon -> Retrieval Lab`.
8. Review policy and audit evidence in `Sophon -> Policies & Audit`.
9. Export backup and logs in `Sophon -> Backup/Restore`.

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
- Runtime not progressing jobs:
  - Ensure runtime status is `running`.
  - Check `Models & Tuning -> Max Ingestion Workers`.
- Retrieval has no passages:
  - Verify at least one ingestion job completed.
- Index integrity degraded:
  - Run `Index -> Validate Index`, inspect failed jobs, retry.
- Restore failure:
  - Validate payload with dry-run and confirm schema compatibility.
