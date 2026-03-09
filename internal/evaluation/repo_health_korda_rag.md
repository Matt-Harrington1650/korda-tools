# Repo Health: KORDA-RAG

## Executive findings
- KR-001 resolved: build/lint/test/audit workflows were executed; major reproducibility issues surfaced in local test/lint runs.
- KR-002 confirmed: architecture is service-oriented by default (FastAPI services, docker compose, explicit host/port bindings).
- KR-003 confirmed: endpoint assumptions are pervasive across compose and runtime configuration.
- KR-004 resolved with constraints: a true in-process library path exists (`NvidiaRAG`, `NvidiaRAGIngestor`) and no-bind smoke succeeded.
- KR-005 confirmed: dependency reproducibility risk remains (mixed lock/manifests and wide dependency surfaces).
- KR-006 confirmed: install/build manifest fragmentation exists across Python + JS + compose/k8s overlays.
- KR-007 confirmed: root `package.json` has no runnable scripts.
- KR-008 resolved: server-binding entrypoints are now explicitly identified and evidenced.
- Auto-remediation applied: cross-platform compose prompt mount bug fixed (`too many colons` class failure on Windows paths).

## Phase 0 — Environment, presence, identity resolution
### Definition of Done
- `C:\code\KORDA-RAG` presence, remote, branch, and baseline state captured.

### Tests (commands run + results)
- `git remote -v`, `git rev-parse HEAD`, `git branch --show-current`, `git status --porcelain`.

Results summary:
- `HEAD=075b2344b6fce1daeee058b71dce37210b56372d`, branch `main`, initial dirty state only from applied compose fixes.

### Findings (severity-ranked: P0/P1/P2/P3)
- P3: baseline complete; no Phase-0 blockers.

### Evidence (file paths + line ranges + short snippets + command output summary)
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase0_repo_baseline_summary.txt:45-50`.

### Changes Applied
- None in Phase 0.

### Re-test Results
- N/A.

### Remaining Blockers
- None.

## Phase 1 — Automated health checks and first patch wave
### Definition of Done
- Python/JS/container scans executed.
- Security scan executed where feasible.
- Safe mechanical fix wave applied.

### Tests (commands run + results)
- Discovery: `Get-ChildItem -Force`, `Get-Content pyproject.toml`, `Get-Content requirements.txt`, `Get-Content uv.lock`, `Get-Content package.json`, workflows listing.
- Python env: created `.venv` with Python 3.12, ran dependency install, `ruff check .`, `pytest -q`, `pip-audit`.
- Container/orchestration: `docker compose config` (root + explicit compose files), kustomize scans, endpoint scans.

Results summary:
- `ruff`: very high issue count (reported `Found 962 errors`).
- `pytest`: interrupted during collection with 49 errors in this local setup.
- `pip-audit`: no known vulnerabilities in the tested env.
- Root `docker compose config`: no root compose file (expected in this repo layout).

### Findings (severity-ranked: P0/P1/P2/P3)
- P1 KR-001 CONFIRMED: automated checks are not green in the default local validation path.
- P1 KR-005 CONFIRMED: reproducibility and environment coupling remain high.
- P2 KR-006 CONFIRMED: manifest and toolchain fragmentation increases setup drift.
- P2 KR-007 CONFIRMED: root JS surface lacks runnable scripts.

### Evidence (file paths + line ranges + short snippets + command output summary)
- `C:\code\KORDA-RAG\package.json:1-7` shows devDeps only and no scripts.
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\final_command_output_summaries.log:611` (`Found 962 errors` in `ruff`).
- `...\final_command_output_summaries.log:663-713` (`pytest` collection errors, interrupted with 49 errors).
- `...\final_command_output_summaries.log:715-720` (`No known vulnerabilities found` from `pip-audit`).
- `...\final_command_output_summaries.log:723-728` (`docker compose config` root missing file).

### Changes Applied
- None in this phase for architecture/semantic behavior.

### Re-test Results
- Validation remains red for `ruff/pytest` in the constructed local env.

### Remaining Blockers
- Test/lint reproducibility not yet production-grade for local contributors.

## Phase 2 — Architecture, layering, boundaries
### Definition of Done
- Runtime shape, endpoint assumptions, store integrations, and reliability scaffolding mapped with direct evidence.

### Tests (commands run + results)
- `rg` scans for imports, HTTP calls, service dependencies, FastAPI/uvicorn, retry/backoff/checkpoint patterns.
- Source tree snapshots and numbered critical file extractions.

### Findings (severity-ranked: P0/P1/P2/P3)
- P0 KR-002 CONFIRMED: default runtime is service-oriented.
- P0 KR-003 CONFIRMED: external/service endpoint assumptions are pervasive.
- P1 KR-008 CONFIRMED: server entrypoints and binding defaults are explicit and active.

### Evidence (file paths + line ranges + short snippets + command output summary)
- Service binding in compose:
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml:14` (`--port 8081 --host 0.0.0.0`).
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-ingestor-server.yaml:14` (`--port 8082 --host 0.0.0.0`).
- FastAPI app surfaces:
  - `C:\code\KORDA-RAG\src\nvidia_rag\rag_server\server.py:104` (`app = FastAPI(...)`).
  - `C:\code\KORDA-RAG\src\nvidia_rag\ingestor_server\server.py:91` (`app = FastAPI(...)`).
- Endpoint defaults in config:
  - `C:\code\KORDA-RAG\src\nvidia_rag\utils\configuration.py:133-135` (`APP_VECTORSTORE_URL`, default `http://localhost:19530`).
  - `C:\code\KORDA-RAG\src\nvidia_rag\utils\configuration.py:466,655,690` service URL env keys (`APP_LLM_SERVERURL`, embedding, ranking).

### Changes Applied
- None in this phase.

### Re-test Results
- N/A (analysis phase).

### Remaining Blockers
- Architecture mismatch for direct desktop embedding remains unresolved.

## Phase 3 — Critical surface review and hardening
### Definition of Done
- Server/config/orchestration critical surfaces reviewed line-by-line.
- Safe mechanical compose fix wave applied.

### Tests (commands run + results)
- Compose and server/config line-level review.
- Re-ran compose config validation on patched files.

### Findings (severity-ranked: P0/P1/P2/P3)
- P1 FIXED: Windows mount interpolation failure (`too many colons`) in compose prompt mount path.
- P1 KR-005 remains: dependency/profile drift still high beyond this scoped fix.

### Evidence (file paths + line ranges + short snippets + command output summary)
Pre-fix symptom:
- User runtime evidence: compose mount failure on Windows path interpolation (`too many colons`).

Code fix evidence:
- `C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml:17,24` now maps `PROMPT_CONFIG_FILE_HOST` to `/prompt.yaml` and sets `PROMPT_CONFIG_FILE: /prompt.yaml`.
- `C:\code\KORDA-RAG\deploy\compose\docker-compose-ingestor-server.yaml:18,28` same normalization.

Post-fix validation evidence:
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\retest_korda_rag_compose_rag_config.log:69-78` shows resolved bind mount target `/prompt.yaml`.
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\retest_korda_rag_compose_ingestor_config.log:69-78` same for ingestor stack.

### Changes Applied
- `deploy/compose/docker-compose-rag-server.yaml`
- `deploy/compose/docker-compose-ingestor-server.yaml`

### Re-test Results
- `docker compose -f ... config` now renders prompt mount correctly in both stacks.

### Remaining Blockers
- Broader architecture/dependency issues unchanged by this mechanical fix.

## Phase 4 — Embedding feasibility, smoke tests, integration decision
### Definition of Done
- No-bind in-process smoke path executed.
- Server-binding and endpoint assumptions reconciled with smoke behavior.

### Tests (commands run + results)
- Added and executed: `C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py` via canonical Sophon interpreter.
- Installed missing runtime dep in that interpreter: `opentelemetry-processor-baggage`.

Results summary:
- In-process import and execution path works for RAG + Ingestor class usage.
- `new_listening_ports: []` during smoke run (no HTTP listener opened by smoke path).
- Ingest call returned expected failed state for empty file list (functional smoke only).

### Findings (severity-ranked: P0/P1/P2/P3)
- P1 KR-004 DISPROVEN (as unresolved claim): library mode is source-proven and executable.
- P0 CR-001/CR-002 (cross): full production embedding without HTTP/service assumptions remains infeasible today.
- P1 CR-004 (cross): observability/runtime dependency stack mismatch remains substantial.

### Evidence (file paths + line ranges + short snippets + command output summary)
- `C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py:16-18,140-193` in-process RAG/Ingestor smoke logic.
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase4_sophonpy_opentelemetry_install.log:1-24` missing dependency remediation.
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase4_integration_smoke.log:970-984` (`new_listening_ports: []`, smoke response payload).

### Changes Applied
- Added smoke harness script in evaluation artifacts.
- Environment remediation in canonical Sophon venv for missing telemetry dependency.

### Re-test Results
- Smoke passes as integration probe with no listener creation.

### Remaining Blockers
- Real ingest/query flows still depend on service endpoints/store dependencies for full behavior.

## Phase 5 — Baseline scoring and commit sequence
### Definition of Done
- KORDA-RAG scored and ordered commit plan prepared.

### Tests (commands run + results)
- Derived from phases 1-4 evidence set.

### Findings (severity-ranked: P0/P1/P2/P3)
- P0 architecture mismatch for strict no-service embed remains.
- P1 local reproducibility/test-health remains weak.

### Evidence (file paths + line ranges + short snippets + command output summary)
- See `internal/remediation/commit_sequence.md`, `internal/remediation/test_results.md`.

### Changes Applied
- Documentation only.

### Re-test Results
- N/A.

### Remaining Blockers
- Full green CI-equivalent local path and no-service runtime profile are not yet complete.

## Scorecard (KORDA-RAG)
- Repo hygiene: 3.0/5
- Code quality: 3.0/5
- Reliability engineering: 2.5/5
- Security engineering: 3.0/5
- Packaging/deployability: 2.5/5

## Go/No-Go (KORDA-RAG)
- Service-mode deployment: **Go with constraints**.
- Direct embedding into KORDA TOOLS without HTTP/microservice assumptions: **No-Go (current state)**.

## Appendix: commands run + output summaries
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase1_korda_rag_*.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase2_korda_rag_*.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\retest_korda_rag_compose_*.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase4_sophonpy_opentelemetry_install.log`
- `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase4_integration_smoke.log`
- `C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py`
