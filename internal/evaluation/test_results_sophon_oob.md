# Sophon OOB Test Results (Decision-Grade)

Date: 2026-03-05  
Repo: `C:\code\ai-tool-hub`  
Engine context inspected: `C:\code\KORDA-RAG`

## Executive Decision
- **NO-GO**

### P0 Blockers
1. **Offline-only guarantee is not enforceable at product boundary**: Tauri execution gateway command supports outbound HTTPS and localhost HTTP for dev hosts.
2. **Sophon runtime is not a real embedded NVIDIA RAG engine path**: ingestion/retrieval/index are synthetic state transitions in a Zustand store, not actual extract/chunk/embed/index pipeline execution.
3. **Ingestion idempotency fails**: repeated ingest of same source doubles doc/chunk counts in evaluation.

---

## PHASE T0 — Test Readiness + Build Integrity
### Definition of Done
- Release-capable build path verified, tests pass, installer artifact produced, dependency risk paths identified.

### Tests (commands run + results)
1. `git status --short` (captured)
2. `git rev-parse HEAD` -> `34bc777c16ad6549fab34739df50098ed26b8c4d`
3. `npm ci` -> success
4. `npm run test -- --run` -> **27 files, 87 tests passed**
5. `npm run build` -> success
6. `npm run tauri:build` -> success
7. Artifact hashing -> NSIS installer hash generated
8. Offline-risk static scan -> outbound-capable paths identified

### Findings
- **P1**: Runtime path still includes external AI endpoint defaults and outbound-capable execution gateway.
- **P2**: Frontend bundle includes large JS chunk warning.

### Evidence
- Build/test logs: `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\t0_npm_test.log`, `t0_npm_build.log`, `t0_tauri_build.log`
- Installer path/hash: `...\\t0_bundle_listing.txt`, `...\\t0_bundle_hash.txt`
- Dependency risk scan: `...\\t0_dependency_offline_risk_scan.txt`
- Code refs:
  - `C:\code\ai-tool-hub\src\features\settings\store\settingsStore.ts:14`
  - `C:\code\ai-tool-hub\src-tauri\src\execution_gateway.rs:102`
  - `C:\code\ai-tool-hub\src-tauri\src\execution_gateway.rs:330`
  - `C:\code\ai-tool-hub\src-tauri\src\lib.rs:145`

---

## PHASE T1 — Fresh Machine Simulation
### Definition of Done
- Clean-state launch recreates runtime DB and migrations.

### Tests (commands run + results)
1. Enumerated app data paths (`%APPDATA%`, `%LOCALAPPDATA%`).
2. Backed up `korda_tools.db`, removed `korda_tools.db*`, launched release app, verified recreation.
3. Queried recreated DB tables and migration markers.
4. Restored original DB from backup after test.

### Findings
- **P2**: `migrations` table row count is `0` while `_sqlx_migrations` has versions `1..20` (dual migration bookkeeping requires explicit operator understanding).

### Evidence
- Reset/recreate summary: `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\t1_clean_recreate_summary.txt`
- Reset log: `...\\t1_real_state_reset.log`
- Restore confirmation: `...\\t1_restore_original_db.txt`

---

## PHASE T2 — Offline-Only + No Localhost HTTP Enforcement
### Definition of Done
- No app-owned TCP listeners for Sophon runtime/admin. Outbound paths identified.

### Tests (commands run + results)
1. Mandatory static scans across app + engine context with required patterns.
2. Dynamic runtime listener audit while packaged app process running:
   - `netstat -ano | findstr LISTENING`
   - `Get-NetTCPConnection -State Listen`
   - `tasklist /fi "PID eq <app pid>"`
3. PID-to-process map for local listeners.

### Findings
- **P0**: Execution gateway allows outbound HTTPS and localhost HTTP (`execution_gateway.rs`), so offline-only is not hard-enforced at platform boundary.
- **P0**: KORDA-RAG context remains HTTP/FastAPI-first (`uvicorn`, `/v1` APIs), not yet integrated as no-HTTP IPC runtime in KORDA TOOLS.
- **P1 (UNVERIFIED)**: Full NIC-disable airgap run was not executed in this shell campaign.
- **Pass condition met**: No TCP listeners owned by `app.exe` process during runtime audit.

### Evidence
- App listener result: `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\t2_getnettcpp_listen_app_pid.txt`
- Runtime pid/task evidence: `...\\t2_listener_runtime_header.txt`, `...\\t2_tasklist_app_pid.txt`
- Local listener map: `...\\t2_local_listener_pid_process_map.txt`
- Static scans:
  - `...\\t2_static_scan_ai_tool_hub_required.txt`
  - `...\\t2_static_scan_korda_rag_required.txt`
  - `...\\t2_static_scan_ai_tool_hub_code_only.txt`
  - `...\\t2_static_scan_korda_rag_src_only.txt`
- Code refs:
  - `C:\code\ai-tool-hub\src-tauri\src\execution_gateway.rs:100-106`
  - `C:\code\ai-tool-hub\src-tauri\src\execution_gateway.rs:327-331`
  - `C:\code\ai-tool-hub\src-tauri\src\lib.rs:137-146`

---

## PHASE T3 — Sophon Runtime Lifecycle + Health
### Definition of Done
- Runtime lifecycle controls are validated in shipped logic path.

### Tests (commands run + results)
1. Ran targeted Sophon suite:
   - `src/features/sophon/policy.test.ts`
   - `src/features/sophon/store/sophonStore.test.ts`
   - `src/pages/sophon/SophonRouting.smoke.test.tsx`
2. Ran combined suite including evaluation tests -> **10 files, 16 tests passed**.

### Findings
- **P1**: Lifecycle validated in in-memory store path; no proof of real embedded NVIDIA engine lifecycle controls.

### Evidence
- Combined suite log: `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\t3_t8_combined_eval_suite.log`
- Runtime start policy assert: `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:230-233`
- Route/nav evidence:
  - `C:\code\ai-tool-hub\src\app\router.tsx:39-51`
  - `C:\code\ai-tool-hub\src\app\AppShell.tsx:115-122`

---

## PHASE T4 — Data Ingestion Pipeline + Reliability
### Definition of Done
- Source/job control + idempotency/retry posture measured with fixtures.

### Tests (commands run + results)
1. Fixture corpus created under `internal/evaluation/fixtures` with checksums.
2. Ran `internal/evaluation/sophon_ingestion_reliability_eval.test.ts`.
3. Captured pause/resume/cancel/retry and repeated ingest counts.

### Findings
- **P0**: Idempotency failed (`docCount`/`chunkCount` doubled on repeat ingest).
- **P1**: Retry linkage not deterministic (`retryJobId` null in measured run).
- **P1**: Pipeline is synthetic (generated counts), not file-content-driven extraction/embedding.

### Evidence
- Fixture manifest: `C:\code\ai-tool-hub\internal\evaluation\fixtures\checksums.sha256`
- Reliability artifact: `C:\code\ai-tool-hub\internal\evaluation\artifacts\sophon_ingestion_reliability_eval.json`
- Test log: `...\\t4_sophon_ingestion_reliability_eval.log`
- Synthetic pipeline behavior:
  - `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:303-378`

---

## PHASE T5 — Index Lifecycle + Snapshot/Restore + Consistency
### Definition of Done
- Snapshot create/restore/publish validated with consistency checks.

### Tests (commands run + results)
1. Ran `internal/evaluation/sophon_index_lifecycle_eval.test.ts`.
2. Created baseline snapshot (S1), changed index, created S2, restored/published S1.
3. Verified invalid restore no-op behavior.

### Findings
- **P2**: Flow works in simulated store; no vector engine-level compaction/atomic publish proof from real index backend.

### Evidence
- Artifact: `C:\code\ai-tool-hub\internal\evaluation\artifacts\sophon_index_lifecycle_eval.json`
- Test log: `...\\t5_sophon_index_lifecycle_eval.log`
- Code refs:
  - `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:464-470`
  - `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:479-494`

---

## PHASE T6 — Retrieval Lab + Citations + Explainability
### Definition of Done
- Retrieval report exports generated from representative query suite.

### Tests (commands run + results)
1. Ran `internal/evaluation/sophon_retrieval_queries_eval.test.ts` (10 queries).
2. Exported JSON + text reports.
3. Ran additional OOB retrieval artifact export.

### Findings
- **P1**: Retrieval grounding is synthetic and source-config-derived, not chunk-level citations from real embeddings/vector retrieval.
- **P2**: Top-k tuning had no effect in measured run (`1 vs 1` passages), indicating limited retrieval realism in current implementation.

### Evidence
- Reports:
  - `C:\code\ai-tool-hub\internal\evaluation\artifacts\sophon_retrieval_queries_report.json`
  - `C:\code\ai-tool-hub\internal\evaluation\artifacts\sophon_retrieval_queries_report.txt`
  - `C:\code\ai-tool-hub\internal\evaluation\artifacts\sophon_retrieval_report.json`
- Test log: `...\\t6_sophon_retrieval_queries_eval.log`
- Code refs: `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:496-511`

---

## PHASE T7 — Policies, RBAC, Audit Trail
### Definition of Done
- Offline gate evidence and audit emission validated; RBAC posture tested.

### Tests (commands run + results)
1. Ran `internal/evaluation/sophon_policy_audit_eval.test.ts`.
2. Ran audit chain tests:
   - `internal/evaluation/audit_chain_eval.test.ts`
   - `internal/evaluation/records_boundary_eval.test.ts`

### Findings
- **P1**: RBAC enforcement gap — viewer role can still mutate sources (`viewerMutationAllowed=true`).
- **P1**: Audit actions emitted but coverage is partial for all required admin actions.

### Evidence
- Artifact: `C:\code\ai-tool-hub\internal\evaluation\artifacts\sophon_policy_audit_eval.json`
- Logs: `...\\t7_sophon_policy_audit_eval.log`, `...\\t3_t8_combined_eval_suite.log`
- Role enforcement gap in code:
  - `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:398-400`
  - `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:399-434`

---

## PHASE T8 — Backup/Restore + Portability
### Definition of Done
- Backup export, dry-run validation, tamper rejection, and restore tested in clean-store simulation.

### Tests (commands run + results)
1. Ran `internal/evaluation/sophon_oob_eval.test.ts`.
2. Exported backup bundle.
3. Verified dry-run success, tampered payload rejection, and post-restore retrieval.

### Findings
- **P1**: Version-compatibility diff/migration gate is not implemented in import path (schema-only validation).
- **P2**: Rollback semantics are implicit (state unchanged on failure) but no explicit transaction/version reconciliation workflow.

### Evidence
- Backup bundle: `C:\code\ai-tool-hub\internal\evaluation\artifacts\sophon_backup_bundle_b1.json`
- Restore eval: `C:\code\ai-tool-hub\internal\evaluation\artifacts\sophon_backup_restore_eval.json`
- Code refs: `C:\code\ai-tool-hub\src\features\sophon\store\sophonStore.ts:517-524`

---

## PHASE T9 — Installer/Updater + Operations
### Definition of Done
- Installer artifact exists, installed app launches, log path discoverable.

### Tests (commands run + results)
1. Verified installer bundle and installed app paths.
2. Launched installed app binary and terminated cleanly.
3. Verified runtime log directory.

### Findings
- **P3**: Updater artifacts are disabled (`createUpdaterArtifacts=false`) — acceptable for offline posture, but update strategy must be operationally documented.

### Evidence
- Installer/ops check log: `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\t9_installer_operations_check.txt`
- Bundle config: `C:\code\ai-tool-hub\src-tauri\tauri.conf.json:27-31`

---

## Required Artifact Output Status
1. `internal/evaluation/test_plan_sophon_oob.md` -> **Created**
2. `internal/evaluation/fixtures/*` + checksums -> **Created**
3. `internal/evaluation/artifacts/*` reports + listener outputs -> **Created**
4. `internal/evaluation/test_results_sophon_oob.md` -> **Created**

---

## Final Go/No-Go
- **NO-GO**

### Minimum Fix Set Before GO
1. Replace or hard-disable outbound-capable execution gateway paths for Sophon runtime in production mode, and remove localhost HTTP allowance.
2. Replace synthetic Sophon ingestion/retrieval state machine with actual embedded/IPC offline RAG engine execution path (no HTTP listeners).
3. Implement true idempotent ingestion checkpoints and deterministic retry linkage.
4. Enforce RBAC gates on mutating Sophon actions.
5. Add explicit backup import version compatibility + rollback transaction semantics.
