# Full Functionality Test Plan

Date: 2026-02-25  
Scope: End-to-end desktop app review (React + Tauri + SQLite), with emphasis on Custom Tools Library and critical user flows.

## Functionality Matrix

| Function | Location | Expected Behavior | I/O | Dependencies | Risk |
|---|---|---|---|---|---|
| Dashboard browse/filter tools | `src/pages/DashboardPage.tsx` | Lists registry tools, search/filter/view mode work | Input: query/category/tags; Output: filtered cards/list | `toolRegistryStore` | Medium |
| Add Registry Tool | `src/pages/AddToolPage.tsx` | Validates and stores tool config + credential refs | Input: form fields + secrets; Output: new tool record | `react-hook-form`, `SecretVault`, plugin registry | High |
| Registry Tool Detail + Execute | `src/pages/ToolDetailPage.tsx` | Edit tool config, run/test tool, export output | Input: config + action; Output: logs/result | execution pipeline, secret vault, adapters | High |
| Chat Tool Calling | `src/pages/ChatPage.tsx` | Threaded tool calls with trace logs and recipe save | Input: message/tool/action; Output: assistant trace + workflow | chat store, execution pipeline, workflows | High |
| Workflows Builder/Runner/Scheduler | `src/pages/WorkflowsPage.tsx` | CRUD workflows, execute, schedule, review logs | Input: steps/schedule; Output: run logs/node logs | workflow stores + scheduler | High |
| Settings backup/restore | `src/pages/SettingsPage.tsx` + settings features | Export/import app state safely | Input: backup file/actions; Output: restored state | storage + backup module | High |
| Custom Tools Library list/search/import | `src/pages/ToolsLibraryPage.tsx` | Search/filter custom tools, import preview + confirm | Input: filters + zip; Output: list + imported tool | custom-tools service + backend commands | High |
| Add Custom Tool wizard | `src/pages/AddCustomToolPage.tsx` | Step validation, template instructions, attach files, save | Input: metadata/version/files; Output: tool or new version | helpers + backend `tool_create`/`tool_add_version` | High |
| Custom Tool Detail/export/delete | `src/pages/CustomToolDetailPage.tsx` | View versions/files/instructions, export zip, delete | Input: version choice; Output: zip payload + deletion | backend `tool_get`, export/import commands | High |
| Secrets commands | `src-tauri/src/secrets.rs` | Secure set/get/delete credential secrets | Input: credential id/value; Output: secure secret operations | keyring provider | High |
| Custom tools CRUD commands | `src-tauri/src/tools/commands.rs` | Create/list/get/delete/add version flows | Input: typed invoke payloads; Output: DB + file writes | db/storage modules | High |
| Custom tools import/export ZIP | `src-tauri/src/tools/zip.rs` | Export safe package and import with integrity checks | Input: version id / zip payload; Output: validated archive content | storage hash/path validation, PowerShell zip ops | Critical |
| Custom tools file storage validation | `src-tauri/src/tools/storage.rs` | sanitize names, enforce allowlist + limits + safe paths | Input: inbound files/paths; Output: staged files or error | SHA256, filesystem | Critical |
| Custom tools DB persistence | `src-tauri/src/tools/db.rs` | Persist tool/version/file/tag metadata correctly | Input: validated rows; Output: consistent relational records | SQLite migrations | High |

## Test Catalog

Notation: each function group has at least 3 Happy (`H`), 3 Edge (`E`), 3 Negative (`N`) tests.

### F1 Dashboard browse/filter tools
- `F1-H1` Load dashboard with existing tools and render counts.
- `F1-H2` Search by exact tool name and open detail.
- `F1-H3` Toggle grid/list mode and persist in session.
- `F1-E1` Empty registry displays empty state CTA.
- `F1-E2` Tag filters with mixed-case values.
- `F1-E3` Very long query string still returns responsive UI.
- `F1-N1` Corrupt local tool record handled without crash.
- `F1-N2` Missing category field in record degrades gracefully.
- `F1-N3` Rapid filter toggles do not freeze UI.

### F2 Add Registry Tool
- `F2-H1` Create tool with no auth.
- `F2-H2` Create tool with existing credential.
- `F2-H3` Create tool with new credential and saved secret.
- `F2-E1` Custom header auth with valid header.
- `F2-E2` Tags with spaces/duplicates normalize properly.
- `F2-E3` Plugin config optional fields left blank where allowed.
- `F2-N1` Missing required name/category blocked.
- `F2-N2` Invalid plugin config shows actionable errors.
- `F2-N3` Secret vault write failure surfaces UI error.

### F3 Registry Tool Detail + Execute
- `F3-H1` Edit metadata and save.
- `F3-H2` Run `test` action and show response summary.
- `F3-H3` Export run output file.
- `F3-E1` Attach max allowed run files and execute.
- `F3-E2` Rotate secret path for existing credential.
- `F3-E3` Cancel in-progress run updates state to cancelled.
- `F3-N1` Missing credential for auth-required tool fails cleanly.
- `F3-N2` Adapter missing for tool type shows adapter_not_found.
- `F3-N3` Timeout path returns timeout error code and UI state.

### F4 Chat Tool Calling
- `F4-H1` Create thread and send run request.
- `F4-H2` Stream chunks append into trace output.
- `F4-H3` Save chat recipe to workflow.
- `F4-E1` First message renames thread title.
- `F4-E2` Tool selection auto-adjusts when tools list changes.
- `F4-E3` Multiple traces in one thread map correctly by id.
- `F4-N1` Empty prompt rejected.
- `F4-N2` Missing selected tool rejected.
- `F4-N3` Execution error still records failure trace.

### F5 Workflows builder/runner/scheduler
- `F5-H1` Create workflow with one step and save.
- `F5-H2` Run workflow and inspect node runs.
- `F5-H3` Add interval schedule and toggle enabled.
- `F5-E1` Add multiple steps with continue-on-error toggles.
- `F5-E2` Cron schedule accepted with 5-field expression.
- `F5-E3` Deleting workflow clears related schedules/logs.
- `F5-N1` Save blocked with no steps.
- `F5-N2` Save blocked with empty tool selection in any step.
- `F5-N3` Invalid interval/cron shows errors.

### F6 Settings backup/restore
- `F6-H1` Export backup file and confirm metadata.
- `F6-H2` Restore backup and verify major stores.
- `F6-H3` Clear logs/settings pathways work.
- `F6-E1` Backup with large history still completes.
- `F6-E2` Import older schema with migration path.
- `F6-E3` Partial optional sections in backup tolerated.
- `F6-N1` Malformed JSON backup rejected.
- `F6-N2` Unsupported schema version rejected with message.
- `F6-N3` Missing required section aborts restore safely.

### F7 Custom Tools list/search/import
- `F7-H1` List tools with no filters.
- `F7-H2` Search by slug/name/tag and open detail.
- `F7-H3` Import valid zip via preview->confirm.
- `F7-E1` Category/tag filters with empty dataset.
- `F7-E2` Preview large-but-valid import package.
- `F7-E3` Import on existing slug with new version merges.
- `F7-N1` Invalid zip payload shows import error.
- `F7-N2` Unsafe zip paths rejected.
- `F7-N3` Duplicate slug+version import rejected.

### F8 Add Custom Tool wizard
- `F8-H1` Create brand new tool with one file.
- `F8-H2` Existing slug path creates new version.
- `F8-H3` Template prefill + editable markdown saved.
- `F8-E1` Multi-file attach with de-dup handling.
- `F8-E2` File-list placeholder inserted at save time.
- `F8-E3` Slug auto-generation and manual override.
- `F8-N1` Missing metadata fields blocked.
- `F8-N2` Empty instructions blocked.
- `F8-N3` Invalid files (size/extension/empty) blocked.

### F9 Custom Tool detail/export/delete
- `F9-H1` Load tool details with versions/files.
- `F9-H2` Export selected version zip payload.
- `F9-H3` Delete tool and return to list.
- `F9-E1` Copy SHA-256 for file.
- `F9-E2` Version switch updates instruction/file panel.
- `F9-E3` Export latest version from header action.
- `F9-N1` Unknown tool id shows empty/error state.
- `F9-N2` Export error surfaces backend message.
- `F9-N3` Clipboard write failure handled.

### F10 Backend custom tools security/IO
- `F10-H1` Accept valid allowlisted files and persist hashes.
- `F10-H2` Export manifest/instructions/files consistent.
- `F10-H3` Import valid archive and persist to DB + disk.
- `F10-E1` High-volume file staging under limits.
- `F10-E2` Repeated import round trips.
- `F10-E3` Filename collisions resolve deterministically.
- `F10-N1` Reject disallowed extensions.
- `F10-N2` Reject unsafe archive paths (`../`, `..\\`, `C:\\`, `\\\\server\\share`, `/absolute`).
- `F10-N3` Reject manifest hash/size mismatches and duplicate names.

## Stress Suite

Executed stress/security-oriented tests:
- `tools::storage::tests::stages_many_files_with_deterministic_unique_names`
- `tools::zip::tests::stress_repeated_import_round_trips`
- `tools::zip::tests::rejects_zip_slip_entries`
- `tools::storage::tests::enforces_file_and_total_size_limits`

Command used:
- `cargo test tools:: -- --nocapture`
