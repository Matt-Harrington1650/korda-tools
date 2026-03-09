# Repo Health: KORDA TOOLS (korda-tools + ai-tool-hub variant)

## Executive findings
- KT-001 resolved: `C:\code\korda-tools` and `C:\code\ai-tool-hub` are related but diverged variants (different `HEAD`, branch, working-tree, and core file hashes).
- KT-002 resolved: automated frontend and Rust validation now executes cleanly in both repos (lint warnings only).
- KT-003 fixed: renderer CSP is now non-null in both repos.
- KT-004 fixed: explicit `typecheck` script added in both repos.
- KT-005 fixed: Cargo metadata moved from placeholder values to repository metadata in both repos.
- KT-007 fixed: production logging now enabled (release level set to `Info`, debug still `Debug`).
- KT-008 fixed: startup panic path removed; `run()` no longer ends in `.expect(...)`.
- KT-006 remains open as design debt: `invoke_handler` in `src-tauri/src/lib.rs` is still a wide coupling hotspot.
- KT-011 resolved as verified: SQL migration schema quality reviewed directly (constraints, FKs, immutability triggers present).

## Phase 0 — Environment, presence, identity resolution
### Definition of Done
- All three target repos were present, with `korda-tools` cloned and validated.
- Identity relationship between `korda-tools` and `ai-tool-hub` was proven with direct metadata, hash, and diff evidence.
- Baseline toolchain inventory captured.

### Tests (commands run + results)
- `git --version`, `node --version`, `npm --version`, `pnpm --version`, `python --version`, `py --version`, `cargo --version`, `rustc --version`, `docker --version`, `kubectl version --client`.
- `Get-ChildItem C:\code | Select-Object Name,Mode,LastWriteTime`.
- `git remote -v`, `git rev-parse HEAD`, `git branch --show-current`, `git status --porcelain` for both repos.
- `Get-Content package.json`, `Get-Content src-tauri\tauri.conf.json`, `Get-Content src-tauri\Cargo.toml` for both repos.
- `Get-FileHash` sample sets and targeted no-index diffs on `src/main.tsx`, `src/app/AppShell.tsx`, `src-tauri/src/lib.rs`.

Results summary:
- Toolchain captured; `pnpm` missing from host PATH.
- `korda-tools`: `HEAD=027deb905482e074d278909a128481ab1ff527c8`, branch `main`, small dirty set for intentional patch files.
- `ai-tool-hub`: `HEAD=1b2a6dd75680c8939613712f38492b89da3a09d8`, branch `pr/phased-evolution-layer6`, very large dirty set due tracked `.sophon-py` and generated artifacts.

### Findings (severity-ranked: P0/P1/P2/P3)
- P2 KT-001 CONFIRMED: repos are not identical; they are divergent variants.
- P3 Observation: full-tree `git diff --no-index --stat` is operationally noisy/expensive in this workspace due tracked virtualenv and node_modules churn.

### Evidence (file paths + line ranges + short snippets + command output summary)
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_environment_versions_final.log:3-48` (`git/node/npm/python/cargo/rustc/docker/kubectl`; `pnpm` not found at `:15-23`).
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_repo_baseline_summary.txt:3-8,24-30,45-50` (repo heads/remotes/branches).
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_identity_table_raw.txt:3-13,15-25` (package/tauri/cargo identity table).
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_common_file_sample_hashes.txt:6-20` (3 matching + 3 differing sample hashes).
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_identity_pair_hashes.txt:2-42` (non-matching key file hashes).
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\final_repo_status_and_diffs.log:215-260` (targeted `AppShell/lib.rs` no-index diffs proving functional divergence).

### Changes Applied
- None in Phase 0 (documentation/evidence only).

### Re-test Results
- N/A.

### Remaining Blockers
- None for identity determination.

## Phase 1 — Automated health checks and first patch wave
### Definition of Done
- Frontend + Rust workflows executed for `korda-tools` and `ai-tool-hub`.
- Security/dependency scans run.
- Safe P0/P1/P2 mechanical fixes auto-applied.

### Tests (commands run + results)
For each repo (`korda-tools` and `ai-tool-hub`):
- Frontend: `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Rust: `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, `cargo build`.
- Scans: `npm audit`, `cargo audit`.

Result summary:
- Frontend test/build/typecheck passed in both repos.
- Lint: warnings only (`react-hooks/incompatible-library`).
- Rust fmt/clippy/test/build passed after small clippy-driven code corrections.
- `npm audit`: 1 high advisory (`minimatch` chain).
- `cargo audit`: 1 vulnerability (`RUSTSEC-2023-0071` in transitive `rsa`) + informational unmaintained/unsound warnings.

### Findings (severity-ranked: P0/P1/P2/P3)
- P1 KT-002 CONFIRMED: baseline automation is executable, but supply-chain advisories remain.
- P1 KT-005 FIXED: placeholder Cargo metadata was present and remediated.
- P2 KT-004 FIXED: no dedicated typecheck script previously; now added.

### Evidence (file paths + line ranges + short snippets + command output summary)
Pre/post code evidence:
- `C:\code\korda-tools\package.json:9` (`"typecheck": "tsc -p tsconfig.json --noEmit"`).
- `C:\code\korda-tools\src-tauri\Cargo.toml:4-7` (description/authors/license/repository set).
- Same changes mirrored in `C:\code\ai-tool-hub\package.json:9` and `C:\code\ai-tool-hub\src-tauri\Cargo.toml:4-7`.

Command output evidence:
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\final_command_output_summaries.log:74-77` (`korda-tools` tests: `17 passed`, `59 passed`).
- `...\final_ai_retest_keylines.log:46-49` (`ai-tool-hub` tests: `32 passed`, `92 passed`).
- `...\final_command_output_summaries.log:108` (`korda-tools` build success).
- `...\final_ai_retest_keylines.log:29` (`ai-tool-hub` build success).
- `...\final_command_output_summaries.log:235-244` (`npm audit` high minimatch advisory chain).
- `...\final_command_output_summaries.log:254` (`cargo audit` includes `RUSTSEC-2023-0071`).

### Changes Applied
- Added `typecheck` script in both repos.
- Replaced placeholder Cargo package metadata in both repos.
- Mechanical clippy fixes (see Phase 3 change list).

### Re-test Results
- `npm run typecheck`, `npm test`, `npm run build`, `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `cargo build` all pass in both repos after patch wave.

### Remaining Blockers
- P1 supply-chain findings remain (npm/cargo audit) and require dependency upgrade strategy.

## Phase 2 — Architecture, layering, boundaries
### Definition of Done
- Dependency direction and desktop boundary patterns reviewed.
- Coupling hotspots identified with code evidence.

### Tests (commands run + results)
- `tree /F` and source scans: `rg` for imports, `@tauri-apps`, `invoke(`, zustand, query usage, storage usage.

### Findings (severity-ranked: P0/P1/P2/P3)
- P2 KT-006 CONFIRMED: `src-tauri/src/lib.rs` `invoke_handler` remains broad/centralized.
- P3 KT-009 DISPROVEN (as risk): runtime gating exists and is functioning (`isTauriRuntime()` guard).

### Evidence (file paths + line ranges + short snippets + command output summary)
- `C:\code\korda-tools\src\main.tsx:5-13` includes runtime gate and scheduler start only in Tauri mode.
- `C:\code\korda-tools\src-tauri\src\lib.rs:99-122` large `invoke_handler(...)` registration surface.
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase2_korda_tools_tauri_imports.txt` + `phase2_korda_tools_invoke_calls.txt` (boundary/call-site scans).

### Changes Applied
- None in this phase for architecture shape (mechanical-only policy honored).

### Re-test Results
- Existing behavior preserved; no regressions detected in test suites.

### Remaining Blockers
- KT-006 remains technical debt; needs planned decomposition (not safe as opportunistic patch).

## Phase 3 — Critical surface review and hardening
### Definition of Done
- Bootstrap, desktop boundary, migrations, logging/error handling, and naming reviewed line-by-line.
- Safe hardening fixes auto-applied.

### Tests (commands run + results)
- Re-ran full retest suite (frontend + Rust + clippy) after hardening changes.
- Reviewed migrations and constraints with direct SQL scans.

### Findings (severity-ranked: P0/P1/P2/P3)
- P1 KT-003 FIXED: CSP no longer null.
- P1 KT-007 FIXED: production logging enabled.
- P1 KT-008 FIXED: startup panic path removed.
- P2 KT-010 FIXED (mechanical scope): user-facing naming harmonized in `AppShell`.
- P3 KT-011 DISPROVEN (as unresolved risk): migration schema is now directly reviewed and quality-checked.

### Evidence (file paths + line ranges + short snippets + command output summary)
Code evidence:
- `C:\code\korda-tools\src-tauri\tauri.conf.json:23` non-null CSP string.
- `C:\code\korda-tools\src-tauri\src\lib.rs:129-132` release log level now `Info`; debug keeps `Debug`.
- `C:\code\korda-tools\src-tauri\src\lib.rs:142` non-panicking `if let Err(error) = app.run(...)` path.
- `C:\code\korda-tools\src\app\AppShell.tsx:69,136,148` normalized `Korda Tools` naming.
- `C:\code\korda-tools\src-tauri\src\tools\storage.rs:170-174` removed identical conditional branches.
- `C:\code\korda-tools\src-tauri\src\tools\db.rs:718` `sort_by_key` clippy fix.

Migration quality evidence:
- `C:\code\ai-tool-hub\src-tauri\migrations\0015_create_governance_core.sql:13,26-27,37,40,78-79,93-95` strong `CHECK` constraints and hash integrity constraints.
- `C:\code\ai-tool-hub\src-tauri\migrations\0016_create_deliverables.sql:37-46` immutable/append-only triggers.

Command evidence:
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase1_korda_tools_cargo_clippy.log:323-345` pre-fix clippy findings (`if_same_then_else`, `unnecessary_sort_by`).
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\retest2_korda_tools_cargo_clippy.log:8` post-fix clippy pass.
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\retest_korda_tools_cargo_test.log:130-160` Rust tests pass.

### Changes Applied
- `korda-tools`: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`, `src-tauri/src/tools/storage.rs`, `src-tauri/src/tools/db.rs`, `src/app/AppShell.tsx`.
- Mirrored equivalent changes in `ai-tool-hub` same file set.

### Re-test Results
- All retests passed in both repos (lint warnings only, no build/test failures).

### Remaining Blockers
- Dependency/security advisories not resolved in this patch wave.
- Invoke-surface decomposition deferred (KT-006).

## Phase 4 — Embedding feasibility impact on KORDA TOOLS
### Definition of Done
- Desktop integration implications for KORDA TOOLS assessed from real KORDA-RAG entrypoints and smoke behavior.

### Tests (commands run + results)
- In-process smoke script executed from canonical Sophon interpreter.

### Findings (severity-ranked: P0/P1/P2/P3)
- P0 (cross-impact) CR-001/CR-002 CONFIRMED: direct desktop embedding without HTTP/service assumptions is not currently safe as default architecture.
- P1 CR-004 CONFIRMED: observability/dependency stack complexity is high for desktop embedding.

### Evidence (file paths + line ranges + short snippets + command output summary)
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase4_integration_smoke.log` shows no listener open (`new_listening_ports: []`) but ingestion returned `state: FAILED` with empty input and runtime touched external-style components.
- KORDA-RAG endpoint defaults and service assumptions shown in compose/config (see cross-repo report).

### Changes Applied
- Added `C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py` for repeatable no-bind verification.

### Re-test Results
- Smoke script runs without opening new listeners and proves in-process call path exists.

### Remaining Blockers
- Full no-service operation is still constrained by endpoint/config defaults and optional external deps.

## Phase 5 — Baseline scoring and commit sequence
### Definition of Done
- KORDA TOOLS scored across hygiene/quality/reliability/security/deployability and ordered commit plan defined.

### Tests (commands run + results)
- Derived from all phase logs and retests.

### Findings (severity-ranked: P0/P1/P2/P3)
- P1: outstanding dependency advisories.
- P2: invoke coupling and large variant drift risk.

### Evidence (file paths + line ranges + short snippets + command output summary)
- See `internal/remediation/commit_sequence.md` and `internal/remediation/test_results.md`.

### Changes Applied
- None in Phase 5 (documentation only).

### Re-test Results
- N/A.

### Remaining Blockers
- Dependency upgrade work and invoke-surface modularization remain.

## Scorecard (KORDA TOOLS)
- Repo hygiene: 3.5/5
- Code quality: 4.0/5
- Reliability engineering: 4.0/5
- Security engineering: 3.0/5
- Packaging/deployability: 3.5/5

## Go/No-Go (KORDA TOOLS)
- Local desktop app: **Go with constraints** (advisory remediation + invoke modularization backlog).
- As host for direct no-service KORDA-RAG embedding: **No-Go currently** (see cross-repo report).

## Appendix: commands run + output summaries
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_environment_versions_final.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_repo_baseline_summary.txt`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_identity_table_raw.txt`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_common_file_sample_hashes.txt`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\final_repo_status_and_diffs.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\final_command_output_summaries.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\final_ai_retest_keylines.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\final_evidence_line_refs.log`
