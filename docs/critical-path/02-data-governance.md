# Data Governance, Provenance, and Immutability

## Scope
This document defines liability-minimizing governance for data handling, provenance, and auditability.

## Binding Decisions
1. `DG-01` Data minimization: collect only fields required for execution, diagnostics, or legal audit.
2. `DG-02` Default private-by-local: no outbound network transmission unless user enables replication adapter.
3. `DG-03` Redaction before persistence: sensitive payload fields must be redacted before writing execution logs.
4. `DG-04` Immutable audit: `audit_events` rows are never updated or deleted.
5. `DG-05` Cryptographic lineage: each audit row hash includes normalized payload plus `prev_hash`.
6. `DG-06` Deterministic replay: state reconstruction must be possible from ordered immutable events.
7. `DG-07` Retention split: operational payload logs may expire by policy; audit lineage records are retained indefinitely.
8. `DG-08` Tenant boundary safety: if multi-project support is added, every table must include `project_id` and composite indexes.

## Data Classes
| Class | Examples | Storage | Retention | Control |
|---|---|---|---|---|
| `PublicConfig` | tool name, base URL | SQLite | indefinite | schema versioning |
| `SensitiveConfig` | API keys, tokens | Secret vault adapter | indefinite until revoked | vault-only access |
| `OperationalLog` | request/response metadata | SQLite | policy-driven | redaction + truncation |
| `AuditLineage` | actor, action, hash chain | SQLite (`audit_events`) | indefinite | append-only |
| `ReleaseEvidence` | artifact hashes, approvals | SQLite (`immutable_release_records`) | indefinite | append-only |

## Provenance Algorithm Contract
```text
record_payload = canonical_json({
  id, actor_id, action, entity_type, entity_id,
  before_json, after_json, timestamp_utc, prev_hash
})
record_hash = sha256(record_payload)
```
Rules:
- Canonical JSON key order is lexicographically sorted.
- `prev_hash` references the previous record in global timestamp/id order.
- Chain verification failure is a release blocker.

## Boundary Isolation Controls
- React UI cannot directly read/write SQLite.
- Tauri commands are the only bridge for desktop capabilities.
- Storage adapters expose minimal interfaces and return typed domain objects.
- External integrations must implement adapter interfaces and pass contract tests.

## Definition of Done
- Data classes are documented and mapped to concrete storage locations.
- Provenance hash-chain algorithm is implemented and verified in automated tests.
- Redaction rules are applied before log persistence.
- Retention policies exist for operational logs without breaking audit immutability.

## Tests
```powershell
# Redaction tests
npm run test -- src/features/tools/logRedaction.test.ts

# Storage + migration tests
npm run test -- src/storage/sqlite/SqliteStorageEngine.test.ts
npm run test -- src/storage/migrations/index.test.ts

# Provenance chain verifier test target (to be added if missing)
npm run test -- src/features/tools/store/toolRunLogStore.ts

# Confirm no plaintext secret columns in migrations
rg -n "api_key|token|secret" src-tauri/migrations
```