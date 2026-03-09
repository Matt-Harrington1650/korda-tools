# Sophon Out-of-Box Verification Plan (KORDA TOOLS Offline Desktop)

## Scope
- Product repo under test: `C:\code\ai-tool-hub`
- Engine context repo inspected for compatibility risk: `C:\code\KORDA-RAG`
- Campaign objective: decision-grade verification that Sophon is out-of-box ready, offline-first, and operated only inside KORDA TOOLS without localhost HTTP server/admin surface.

## Environment
- Host: Windows (PowerShell + WSL available)
- Date: 2026-03-05
- Build mode: production bundle (`npm run build`, `npm run tauri:build`)
- Evaluation artifacts root: `C:\code\ai-tool-hub\internal\evaluation`

## Critical Gating Rules
1. Any Sophon localhost HTTP server requirement or listener is a fail.
2. Any required online dependency for normal Sophon operation is a fail.
3. Ingestion lifecycle must be resumable and idempotent within declared behavior.
4. Backup/restore must validate payloads and support safe failure behavior.

## Fixture Corpus (for ingestion/retrieval eval)
Path: `C:\code\ai-tool-hub\internal\evaluation\fixtures`

Required fixture set:
1. `multimodal_test.pdf`
2. `table_test.pdf`
3. `functional_validation.pdf`
4. `product_catalog.pdf` (large-ish)
5. `fixture_text_heavy.txt`
6. `fixture_notes.md`
7. `fixture_walkthrough.txt`
8. `fixture_datasheet.docx`
9. `fixture_corrupt.pdf` (intentionally truncated)

Integrity manifest:
- `C:\code\ai-tool-hub\internal\evaluation\fixtures\checksums.sha256`

## Phased Test Execution

### T0 — Readiness + Build Integrity
Commands:
1. `git status --short`
2. `git rev-parse HEAD`
3. `npm ci`
4. `npm run test -- --run`
5. `npm run build`
6. `npm run tauri:build`
7. Artifact hash listing for NSIS bundle.
8. Static runtime-risk scan for network/dependency paths.

Pass criteria:
1. Release build and installer created.
2. Unit baseline passes.
3. Runtime dependency-risk paths identified and documented.

### T1 — Fresh Machine Simulation
Commands:
1. Identify app state folders under `%APPDATA%` and `%LOCALAPPDATA%`.
2. Clean-state simulation by removing `korda_tools.db*`, relaunching app, and verifying DB recreation.
3. SQLite table/migration verification.

Pass criteria:
1. App launches after reset.
2. DB recreated with expected tables/migrations.

### T2 — Offline-Only + No Localhost HTTP
Commands:
1. Mandatory static scan:
   - `rg -n -S "http://|https://|localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|listen\\(|fastapi|uvicorn|express|flask|aiohttp|socket\\.listen|createServer" ...`
2. Dynamic listener scan while app is running:
   - `netstat -ano | findstr LISTENING`
   - `Get-NetTCPConnection -State Listen ...`
   - `tasklist /fi "PID eq <app pid>"`
3. PID-to-process listener mapping.

Pass criteria:
1. No app-owned TCP listener used by Sophon management/runtime.
2. Any egress-capable code paths are explicitly identified.

### T3 — Runtime Lifecycle + Health
Commands:
1. Targeted Sophon runtime tests (`policy`, `store`, route smoke).
2. Combined evaluation suite run.

Pass criteria:
1. Start/stop semantics pass in tested runtime path.
2. Health status transitions and logs/audit evidence present.

### T4 — Ingestion Pipeline Reliability
Commands:
1. Run reliability eval test:
   - `internal/evaluation/sophon_ingestion_reliability_eval.test.ts`
2. Capture pause/resume/cancel/retry behavior + idempotency metrics.

Pass criteria:
1. Control operations behave deterministically.
2. Idempotency and retry behavior explicitly measured.

### T5 — Index Lifecycle + Snapshot/Restore
Commands:
1. Run index lifecycle eval test:
   - `internal/evaluation/sophon_index_lifecycle_eval.test.ts`

Pass criteria:
1. Snapshot create/restore/publish flow works.
2. Invalid restore request handled safely.

### T6 — Retrieval Lab + Citations/Explainability
Commands:
1. Run retrieval query suite (10 queries):
   - `internal/evaluation/sophon_retrieval_queries_eval.test.ts`
2. Export JSON + human-readable reports.

Pass criteria:
1. Report artifacts generated.
2. Query answers and grounded passage data present.

### T7 — Policies, RBAC, Audit
Commands:
1. Run policy/audit eval:
   - `internal/evaluation/sophon_policy_audit_eval.test.ts`
2. Run chain/records audit tests.

Pass criteria:
1. Offline gate events recorded.
2. Audit events emitted for key actions.
3. RBAC posture explicitly verified.

### T8 — Backup/Restore + Portability
Commands:
1. Run OOB eval for backup/export/import:
   - `internal/evaluation/sophon_oob_eval.test.ts`
2. Validate dry-run, tampered payload handling, restore behavior.

Pass criteria:
1. Backup bundle generated.
2. Dry-run and restore succeed.
3. Tampered payload rejection preserves state.

### T9 — Installer/Operations
Commands:
1. Verify installed app paths and uninstaller in `%LOCALAPPDATA%\Korda Tools`.
2. Launch installed app binary.
3. Verify log folder exists.

Pass criteria:
1. Installer artifact exists and installed app launches.
2. Operational log path is discoverable.

## Required Outputs
1. `internal/evaluation/artifacts/command_logs/*` (command evidence)
2. `internal/evaluation/fixtures/*` + `checksums.sha256`
3. `internal/evaluation/artifacts/*` (retrieval/backup/listener outputs)
4. `internal/evaluation/test_results_sophon_oob.md` (phase verdicts + Go/No-Go)

## Acceptance Checklist
- [ ] No Sophon localhost HTTP listener/server requirement
- [ ] Offline-only runtime enforcement verified (or explicitly failed)
- [ ] Ingestion lifecycle control + idempotency verified
- [ ] Retrieval with grounding artifacts exported
- [ ] Audit/policy evidence present
- [ ] Backup/restore dry-run and restore validated
- [ ] Installer/operational readiness validated
