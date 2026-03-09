# Patch Log

## PATCH-001
- Repo: `korda-tools` + `ai-tool-hub`
- Finding IDs addressed: `KT-004`
- Files changed:
  - `C:\code\korda-tools\package.json`
  - `C:\code\ai-tool-hub\package.json`
- Why this patch was safe:
  - Adds one explicit script alias (`typecheck`) to existing compiler invocation; no runtime behavior change.
- Validation commands:
  - `npm run typecheck` (both repos)
- Result:
  - Pass in both repos.
- Rollback path:
  - `git -C <repo> restore package.json`

## PATCH-002
- Repo: `korda-tools` + `ai-tool-hub`
- Finding IDs addressed: `KT-005`
- Files changed:
  - `C:\code\korda-tools\src-tauri\Cargo.toml`
  - `C:\code\ai-tool-hub\src-tauri\Cargo.toml`
- Why this patch was safe:
  - Metadata-only manifest fields (`description/authors/license/repository`), no dependency or code path changes.
- Validation commands:
  - `cargo build` (both repos)
- Result:
  - Pass in both repos.
- Rollback path:
  - `git -C <repo> restore src-tauri/Cargo.toml`

## PATCH-003
- Repo: `korda-tools` + `ai-tool-hub`
- Finding IDs addressed: `KT-003`
- Files changed:
  - `C:\code\korda-tools\src-tauri\tauri.conf.json`
  - `C:\code\ai-tool-hub\src-tauri\tauri.conf.json`
- Why this patch was safe:
  - Replaces `null` CSP with explicit restrictive policy preserving required IPC/localhost channels.
- Validation commands:
  - `npm run build`
  - `cargo build`
- Result:
  - Build succeeded in both repos.
- Rollback path:
  - `git -C <repo> restore src-tauri/tauri.conf.json`

## PATCH-004
- Repo: `korda-tools` + `ai-tool-hub`
- Finding IDs addressed: `KT-007`, `KT-008`
- Files changed:
  - `C:\code\korda-tools\src-tauri\src\lib.rs`
  - `C:\code\ai-tool-hub\src-tauri\src\lib.rs`
- Why this patch was safe:
  - Logging setup changed from debug-only plugin registration to explicit debug/release levels.
  - Terminal startup panic replaced with non-panicking error reporting.
  - No command signature changes.
- Validation commands:
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo test`
  - `cargo build`
- Result:
  - All pass in both repos.
- Rollback path:
  - `git -C <repo> restore src-tauri/src/lib.rs`

## PATCH-005
- Repo: `korda-tools` + `ai-tool-hub`
- Finding IDs addressed: clippy gate under `KT-002`
- Files changed:
  - `C:\code\korda-tools\src-tauri\src\tools\storage.rs`
  - `C:\code\korda-tools\src-tauri\src\tools\db.rs`
  - `C:\code\ai-tool-hub\src-tauri\src\tools\storage.rs`
  - `C:\code\ai-tool-hub\src-tauri\src\tools\db.rs`
- Why this patch was safe:
  - Mechanical refactors only:
    - Removed duplicate `if` branch returning identical value.
    - Replaced `sort_by(...)` with equivalent `sort_by_key(...)`.
- Validation commands:
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo test`
- Result:
  - Clippy/test pass in both repos.
- Rollback path:
  - `git -C <repo> restore src-tauri/src/tools/storage.rs src-tauri/src/tools/db.rs`

## PATCH-006
- Repo: `korda-tools` + `ai-tool-hub`
- Finding IDs addressed: `KT-010`
- Files changed:
  - `C:\code\korda-tools\src\app\AppShell.tsx`
  - `C:\code\ai-tool-hub\src\app\AppShell.tsx`
- Why this patch was safe:
  - Text-only naming normalization in shell/header/welcome labels.
- Validation commands:
  - `npm test`
  - `npm run build`
- Result:
  - Pass in both repos.
- Rollback path:
  - `git -C <repo> restore src/app/AppShell.tsx`

## PATCH-007
- Repo: `KORDA-RAG`
- Finding IDs addressed: `KR-008`, cross-platform compose startup blocker
- Files changed:
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-rag-server.yaml`
  - `C:\code\KORDA-RAG\deploy\compose\docker-compose-ingestor-server.yaml`
- Why this patch was safe:
  - Scope limited to bind mount/env mapping for prompt file path.
  - Changes are compatibility-oriented and do not alter model/business logic.
- Validation commands:
  - `docker compose -f deploy/compose/docker-compose-rag-server.yaml config`
  - `docker compose -f deploy/compose/docker-compose-ingestor-server.yaml config`
- Result:
  - Config renders cleanly with stable `/prompt.yaml` mount target.
- Rollback path:
  - `git -C C:\code\KORDA-RAG restore deploy/compose/docker-compose-rag-server.yaml deploy/compose/docker-compose-ingestor-server.yaml`

## PATCH-008
- Repo: `ai-tool-hub` evaluation artifacts
- Finding IDs addressed: `KR-004`, `CR-003`
- Files changed:
  - `C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py`
- Why this patch was safe:
  - Adds isolated evaluation harness only; no product runtime path altered.
- Validation commands:
  - `C:\code\ai-tool-hub\.sophon-py\Scripts\python.exe C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py`
- Result:
  - In-process no-bind smoke succeeds; no new listening ports.
- Rollback path:
  - `git -C C:\code\ai-tool-hub restore internal/evaluation/integration_smoke.py`

## PATCH-009 (environment remediation)
- Repo: runtime environment (`.sophon-py` venv)
- Finding IDs addressed: `CR-004`
- Files changed:
  - Environment packages only (`opentelemetry-processor-baggage` install)
- Why this patch was safe:
  - Dependency install scoped to canonical Sophon venv.
- Validation commands:
  - rerun integration smoke script.
- Result:
  - telemetry import blocker cleared for smoke path.
- Rollback path:
  - `C:\code\ai-tool-hub\.sophon-py\Scripts\python.exe -m pip uninstall opentelemetry-processor-baggage`
