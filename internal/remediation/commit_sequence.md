# Commit Sequence

## Commit 01: prerequisite metadata/build hygiene
- Files touched:
  - `C:\code\korda-tools\package.json`
  - `C:\code\korda-tools\src-tauri\Cargo.toml`
  - `C:\code\ai-tool-hub\package.json`
  - `C:\code\ai-tool-hub\src-tauri\Cargo.toml`
- Rationale:
  - Add explicit `typecheck` script and replace placeholder Rust package metadata.
- Dependency order:
  - First, to stabilize CI and developer validation commands before hardening patches.
- Validation commands:
  - `npm run typecheck`
  - `cargo build`
- Rollback note:
  - `git restore package.json src-tauri/Cargo.toml`

## Commit 02: security hardening
- Files touched:
  - `C:\code\korda-tools\src-tauri\tauri.conf.json`
  - `C:\code\ai-tool-hub\src-tauri\tauri.conf.json`
- Rationale:
  - Replace `csp: null` with explicit CSP policy.
- Dependency order:
  - After build hygiene; before reliability patching.
- Validation commands:
  - `npm run build`
  - `cargo build`
- Rollback note:
  - `git restore src-tauri/tauri.conf.json`

## Commit 03: reliability/logging/error-path fixes
- Files touched:
  - `C:\code\korda-tools\src-tauri\src\lib.rs`
  - `C:\code\korda-tools\src-tauri\src\tools\storage.rs`
  - `C:\code\korda-tools\src-tauri\src\tools\db.rs`
  - `C:\code\ai-tool-hub\src-tauri\src\lib.rs`
  - `C:\code\ai-tool-hub\src-tauri\src\tools\storage.rs`
  - `C:\code\ai-tool-hub\src-tauri\src\tools\db.rs`
- Rationale:
  - Enable production logging, remove startup panic path, and clear clippy blocking issues.
- Dependency order:
  - After security baseline to ensure runtime hardening builds on safe config.
- Validation commands:
  - `cargo fmt --check`
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo test`
  - `cargo build`
- Rollback note:
  - `git restore src-tauri/src/lib.rs src-tauri/src/tools/storage.rs src-tauri/src/tools/db.rs`

## Commit 04: packaging/deployability fixes
- Files touched:
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml`
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-ingestor-server.yaml`
- Rationale:
  - Fix Windows-incompatible prompt mount interpolation by mapping host file to stable `/prompt.yaml`.
- Dependency order:
  - After reliability commit so runtime/container deployment issues are addressed next.
- Validation commands:
  - `docker compose -f deploy/compose/docker-compose-rag-server.yaml config`
  - `docker compose -f deploy/compose/docker-compose-ingestor-server.yaml config`
- Rollback note:
  - `git restore deploy/compose/docker-compose-rag-server.yaml deploy/compose/docker-compose-ingestor-server.yaml`

## Commit 05: offline/library-mode integration support changes
- Files touched:
  - `C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py`
- Rationale:
  - Add repeatable no-bind in-process smoke harness to prove/disprove library-mode feasibility.
- Dependency order:
  - After deployability fixes; this validates integration feasibility against stabilized runtime.
- Validation commands:
  - `C:\code\ai-tool-hub\.sophon-py\Scripts\python.exe C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py`
- Rollback note:
  - `git restore internal/evaluation/integration_smoke.py`

## Commit 06: documentation and evaluation artifact refresh
- Files touched:
  - `C:\code\ai-tool-hub\internal\evaluation\repo_health_korda_tools.md`
  - `C:\code\ai-tool-hub\internal\evaluation\repo_health_korda_rag.md`
  - `C:\code\ai-tool-hub\internal\evaluation\cross_repo_risks_and_recommendations.md`
  - `C:\code\ai-tool-hub\internal\evaluation\evidence_index.md`
  - `C:\code\ai-tool-hub\internal\evaluation\integration_smoke_results.md`
  - `C:\code\ai-tool-hub\internal\remediation\patch_log.md`
  - `C:\code\ai-tool-hub\internal\remediation\test_results.md`
  - `C:\code\ai-tool-hub\internal\remediation\commit_sequence.md`
- Rationale:
  - Preserve reproducible evidence trail and decision record.
- Dependency order:
  - Final commit after all code and verification actions.
- Validation commands:
  - Manual markdown review + cross-link check.
- Rollback note:
  - `git restore internal/evaluation/*.md internal/remediation/*.md`
