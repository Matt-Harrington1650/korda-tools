# Component Inventory (Phase 0)

## Definition of Done
- Inventory includes governance docs, runtime code paths, adapters, migrations, tests, and CI workflows.
- Component evidence table is populated with `Component | File | Purpose | Claimed Control | Runtime Enforced? (Y/N)`.
- Controls are classified as code-enforced, schema-enforced, test-enforced, or docs-only.

## Tests
1. `git status --short`
- Result: `?? internal/evaluation/`.
- Status: Pass (evaluation workspace isolated to `/internal/evaluation`).
2. `git log --oneline --decorate -n 30`
- Result: HEAD `34310e6` on `pr/phased-evolution-layer6`; `origin/main` at `027deb9`.
- Status: Pass.
3. `rg -n "ObjectStore|DeliverableService|AuditService|migrations|classification|immutability|record_of_authority|control matrix" docs src src-tauri`
- Result: Matches in records governance services, storage services, audit service, migration chain, and policy docs.
- Status: Pass.
4. `Get-ChildItem docs,src,src-tauri,.github -Recurse -Depth 5 ...`
- Result: Confirmed presence of docs/policies, app services, tauri commands, migrations, workflows.
- Status: Pass.

## Findings (severity-ranked)
- Critical
  - None in inventory phase.
- High
  - Multiple policy domains are present as documentation but not yet mapped to clear runtime enforcement points in the same files (for example classification and AI confidence policies in `docs/` vs sparse runtime checks in `src/`).
- Medium
  - Dual migration directories exist (`/migrations` and `/src-tauri/migrations`), requiring explicit authority mapping to avoid operator confusion.
- Low
  - Inventory command over-included build artifacts (`src-tauri/target`) on first run; corrected with filtered listing.

## Evidence
### Component Evidence Table
| Component | File | Purpose | Claimed Control | Runtime Enforced? (Y/N) |
|---|---|---|---|---|
| Records Governance UI | `src/pages/RecordsGovernancePage.tsx` | Ingest/finalize/verify interactions | UI routes through services; no direct FS write | Y (service-mediated) |
| Tool Execution UI Hook | `src/features/tools/hooks/useToolExecution.ts` | Runs tool execution pipeline | Request execution guardrails, logging, stream state | Y (for execution path), but model egress not policy-gated |
| Execution HTTP Helper | `src/execution/helpers.ts` | Performs outbound HTTP calls | Tool API invocation and response shaping | Y |
| Object Store Service | `src/services/storage/ObjectStoreService.ts` | Single write entry for immutable objects | Naming policy, metadata write, audit append | Y (partial: policy enforcer TODO) |
| Local Object Store Adapter | `src/services/storage/LocalObjectStoreAdapter.ts` | Content-addressed immutable storage adapter | Dedup by hash path existence, read-only retrieval | Y |
| Object Store Bridge | `src/services/storage/createObjectStoreFsBridge.ts` | Tauri invoke bridge or in-memory fallback | UI-isolated FS access through backend command bridge | Y |
| Tauri Object Store Commands | `src-tauri/src/object_store.rs` | Filesystem boundary commands | Path sanitization, atomic write, read/exists | Y |
| Records Governance Service | `src/features/records/RecordsGovernanceService.ts` | App service orchestration for ingest/deliverables/audit | Project context, metadata persistence, audit append | Y (partial; scope bypass defect observed) |
| Deliverable Service | `src/services/deliverables/DeliverableService.ts` | Finalization/versioning integrity | AI output authority reject; hash-change required | Y (partial; RBAC/policy TODO) |
| Audit Service | `src/services/audit/AuditService.ts` | Hash-chain audit append/verify/export | canonical serialization, prev-hash chain, exports | Y |
| Runtime Migration Chain | `src-tauri/src/lib.rs` + `src-tauri/migrations/*` | Startup schema evolution | Ordered migration list and governance versions present | Y |
| Root Migration Specs | `migrations/0001_init.sql` ... `0004_audit_chain.sql` | Design/reference migration artifacts | Schema intent docs and SQL controls | N (non-runtime authoritative by current wiring) |
| CI Workflow | `.github/workflows/ci.yml` | Build/test/policy scans | UI FS import scan, migration-chain sanity grep | Y |
| Release Workflow | `.github/workflows/release-windows.yml` | Release packaging and publishing | Tag-triggered release build/upload | Y (with governance/tag mismatch risk) |
| Governance Constitution | `docs/constitution_v1.md` | Binding architecture controls | Boundary, immutability, audit, provenance mandates | N (docs intent only) |
| AI Control Matrix | `docs/ai_storage_control_matrix_v1.md` | Risk control mapping | Prevention/detection/logging/test procedures | N (docs intent only) |
| Classification Policy | `docs/data_classification_policy_v1.md` | Data class + AI/export/retention policy | Default-deny AI for sensitive classes, retention/export rules | N (docs intent only) |
| Record of Authority Policy | `docs/record_of_authority_v1.md` | Authoritative artifact rules | AI output never authoritative | N (docs intent only, partially reflected in service code) |
| Records Service Tests | `src/features/records/RecordsGovernanceService.test.ts` | Validate finalize/version and AI authority rejection | Finalization/version flow + AI reject | Y |
| Evaluation Harness Tests | `internal/evaluation/audit_chain_eval.test.ts`, `internal/evaluation/records_boundary_eval.test.ts` | Stress test audit tamper and project boundary behavior | Tamper detection + scope bypass reproduction | Y |

### Control Coverage Classification
- Code-enforced
  - `src/services/storage/ObjectStoreService.ts` (naming policy check, metadata + audit append).
  - `src/services/deliverables/DeliverableService.ts` (`DELIVERABLE_VERSION_HASH_UNCHANGED`, `ARTIFACT_AUTHORITY_REJECTED`).
  - `src/services/audit/AuditService.ts` (canonical chain/verify/export).
  - `src/features/records/RecordsGovernanceService.ts` (service orchestration and audit persistence path).
- Schema-enforced
  - `src-tauri/migrations/0016_create_deliverables.sql` (append-only triggers on `deliverable_versions`).
  - `src-tauri/migrations/0017_harden_audit_chain.sql` (append-only triggers on `audit_log`).
  - `src-tauri/migrations/0015_create_governance_core.sql` (FK/CHECK constraints for sensitivity and AI query fields).
- Test-enforced
  - `src-tauri/src/lib.rs` migration chain tests.
  - `src/services/db/migrate.test.ts` ordered apply/skip/failure behavior.
  - `src/services/storage/ObjectStoreService.test.ts` naming policy and metadata checks.
  - `internal/evaluation/*` stress tests.
- Docs-only
  - `docs/constitution_v1.md`, `docs/data_classification_policy_v1.md`, `docs/ai_confidence_labeling_policy_v1.md`, `docs/ai_storage_control_matrix_v1.md`, `docs/repo_governance_v1.md`.

### Targeted files covering required governance/control domains
- Object storage: `src/services/storage/ObjectStore.ts`, `src/services/storage/ObjectStoreService.ts`, `src/services/storage/LocalObjectStoreAdapter.ts`, `src-tauri/src/object_store.rs`, `docs/object_store_v1.md`.
- Deliverable authority: `src/services/deliverables/DeliverableService.ts`, `docs/record_of_authority_v1.md`, `docs/immutability_v1.md`.
- Audit chain: `src/services/audit/AuditService.ts`, `src-tauri/migrations/0017_harden_audit_chain.sql`, `docs/audit_chain_v1.md`.
- Schema migration: `src-tauri/src/lib.rs`, `src-tauri/migrations/*.sql`, `docs/migration_authority_v1.md`, `src/services/db/migrate.ts`.
- Classification + AI policy: `docs/data_classification_policy_v1.md`, `docs/ai_confidence_labeling_policy_v1.md`, `docs/ai_storage_control_matrix_v1.md`, `src-tauri/migrations/0015_create_governance_core.sql`.
- Record of authority: `docs/record_of_authority_v1.md`, `src/services/deliverables/DeliverableService.ts`.

