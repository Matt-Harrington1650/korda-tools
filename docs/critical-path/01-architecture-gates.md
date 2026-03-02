# Critical Path Architecture Gates

## Scope
This document defines the binding architecture contract for the Windows-first desktop application (Tauri + React) with local SQLite as system of record.

## Binding Decisions
1. `BD-01` Local-first authority: local SQLite is the only authoritative write target for runtime state.
2. `BD-02` Cloud-ready abstraction: cloud integrations are adapter implementations that consume replicated events; they do not bypass local persistence.
3. `BD-03` Boundary isolation: UI layer may only call domain services; domain services may only call storage/execution adapters; adapters may not import UI modules.
4. `BD-04` Tauri import safety: no `@tauri-apps/*` static top-level imports in modules used by web runtime.
5. `BD-05` Immutability: audit and execution evidence is append-only; correction requires compensating records, never mutation or delete.
6. `BD-06` Provenance chain: every state-changing command writes an audit record with `prev_hash` and `record_hash` using SHA-256.
7. `BD-07` Versioned schemas: all persisted entity schemas and migrations are explicitly versioned and forward-only.
8. `BD-08` Fail-closed security: unknown adapter type, signature mismatch, or schema mismatch must abort execution.
9. `BD-09` Secret handling: credentials are stored only in vault abstractions; no plaintext secret in SQLite.
10. `BD-10` Timestamp format: all timestamps are UTC ISO-8601 with milliseconds.

## Gated Critical Path
| Gate | Dependency | Required Output | Exit Criteria |
|---|---|---|---|
| `G0` | none | Boundary map and ownership | Layer boundaries documented and approved |
| `G1` | `G0` | Adapter contracts for storage/execution/cloud | Compile-time interfaces stable |
| `G2` | `G1` | SQLite schema set for tools, runs, audit, provenance | Migrations are forward-only and deterministic |
| `G3` | `G2` | Command write-path emits audit + provenance records | Every state mutation has chain-linked evidence |
| `G4` | `G3` | Read APIs for audit verification and replay | Hash-chain verification passes |
| `G5` | `G4` | Automated checks (unit + integration + policy scans) | CI command set passes on Windows |
| `G6` | `G5` | Release sign-off packet with hashes and approvals | Immutable release record stored |

## Adapter Contracts (Cloud-ready, Local-first)
```ts
export interface AuditRecord {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: string | null;
  afterJson: string | null;
  timestampUtc: string;
  prevHash: string | null;
  recordHash: string;
}

export interface AuditStoreAdapter {
  append(record: Omit<AuditRecord, "recordHash">): Promise<AuditRecord>;
  getByEntity(entityType: string, entityId: string): Promise<AuditRecord[]>;
  verifyChain(fromTimestampUtc?: string): Promise<{ ok: boolean; brokenAtId?: string }>;
}

export interface ReplicationAdapter {
  pushAuditBatch(records: AuditRecord[]): Promise<{ pushed: number; checkpoint: string }>;
  pullPolicyUpdates(sinceCheckpoint: string): Promise<{ checkpoint: string; policies: unknown[] }>;
}
```

## SQLite Schema Contract
```sql
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  timestamp_utc TEXT NOT NULL,
  prev_hash TEXT,
  record_hash TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON audit_events(entity_type, entity_id, timestamp_utc);

CREATE TABLE IF NOT EXISTS immutable_release_records (
  id TEXT PRIMARY KEY,
  release_version TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at_utc TEXT NOT NULL,
  notes TEXT
);
```

## Definition of Done
- All binding decisions in this file are accepted as mandatory constraints.
- Gates `G0` through `G6` are represented in implementation planning with no skipped dependency.
- Adapter contracts are mapped to concrete TypeScript or Rust interfaces in source.
- Audit and release schemas are implemented via migrations before release.

## Tests
```powershell
# Policy scan: no unsafe top-level Tauri imports in web-sensitive paths
rg "^import .*@tauri-apps/" src | rg -v "src/lib/tauri.ts|src/desktop"

# Build and unit checks
npm run lint
npm run test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml

# Migration presence check
rg "audit_events|immutable_release_records" src-tauri/migrations
```