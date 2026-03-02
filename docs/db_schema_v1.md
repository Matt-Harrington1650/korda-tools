# Database Schema (v1)

## ERD Description
Entities:
- `workspaces` (top-level tenant boundary)
- `projects` (belongs to workspace)
- `artifacts` (belongs to project)
- `provenance_records` (belongs to artifact + project)
- `retention_policies` (belongs to project, one active policy row per project)
- `audit_log` (belongs to workspace + project)
- `ai_queries` (belongs to workspace + project, optional provenance link)

Relationships:
- `workspaces (1) -> (N) projects`
- `projects (1) -> (N) artifacts`
- `artifacts (1) -> (N) provenance_records`
- `projects (1) -> (N) provenance_records`
- `projects (1) -> (1) retention_policies` (enforced via unique `project_id`)
- `projects (1) -> (N) audit_log`
- `workspaces (1) -> (N) audit_log`
- `projects (1) -> (N) ai_queries`
- `workspaces (1) -> (N) ai_queries`
- `provenance_records (1) -> (N) ai_queries` (optional via nullable FK)

## Table Fields, Types, Constraints

### workspaces
- `id TEXT PRIMARY KEY` (UUID/ULID)
- `name TEXT NOT NULL`
- `slug TEXT NOT NULL UNIQUE`
- `created_at_utc TEXT NOT NULL`
- `updated_at_utc TEXT NOT NULL`

### projects
- `id TEXT PRIMARY KEY`
- `workspace_id TEXT NOT NULL` FK -> `workspaces.id`
- `name TEXT NOT NULL`
- `status TEXT NOT NULL` CHECK in (`active`, `archived`)
- `created_at_utc TEXT NOT NULL`
- `updated_at_utc TEXT NOT NULL`
- `UNIQUE(workspace_id, name)`

### artifacts
- `id TEXT PRIMARY KEY`
- `project_id TEXT NOT NULL` FK -> `projects.id`
- `sha256 TEXT NOT NULL` CHECK lowercase 64 hex
- `object_key TEXT NOT NULL UNIQUE`
- `mime_type TEXT NOT NULL`
- `size_bytes INTEGER NOT NULL` CHECK >= 0
- `original_name TEXT NOT NULL`
- `created_by TEXT NOT NULL`
- `created_at_utc TEXT NOT NULL`
- `immutable INTEGER NOT NULL DEFAULT 1` CHECK = 1
- `UNIQUE(project_id, sha256)`

### provenance_records
- `id TEXT PRIMARY KEY`
- `project_id TEXT NOT NULL` FK -> `projects.id`
- `artifact_id TEXT NOT NULL` FK -> `artifacts.id`
- `source_type TEXT NOT NULL` CHECK in (`upload`, `import`, `generated`, `external_ref`)
- `source_ref TEXT NOT NULL`
- `citation TEXT`
- `captured_at_utc TEXT NOT NULL`
- `created_by TEXT NOT NULL`

### retention_policies
- `id TEXT PRIMARY KEY`
- `project_id TEXT NOT NULL UNIQUE` FK -> `projects.id`
- `retention_days INTEGER NOT NULL` CHECK > 0
- `legal_hold INTEGER NOT NULL DEFAULT 0` CHECK in (0,1)
- `purge_mode TEXT NOT NULL` CHECK in (`soft_delete`, `hard_delete_disabled`)
- `effective_from_utc TEXT NOT NULL`
- `updated_at_utc TEXT NOT NULL`

### audit_log
- `id TEXT PRIMARY KEY`
- `workspace_id TEXT NOT NULL` FK -> `workspaces.id`
- `project_id TEXT NOT NULL` FK -> `projects.id`
- `actor_id TEXT NOT NULL`
- `action TEXT NOT NULL`
- `entity_type TEXT NOT NULL`
- `entity_id TEXT NOT NULL`
- `event_ts_utc TEXT NOT NULL`
- `prev_hash TEXT` CHECK null or lowercase 64 hex
- `event_hash TEXT NOT NULL UNIQUE` CHECK lowercase 64 hex
- `metadata_json TEXT`

### ai_queries
- `id TEXT PRIMARY KEY`
- `workspace_id TEXT NOT NULL` FK -> `workspaces.id`
- `project_id TEXT NOT NULL` FK -> `projects.id`
- `query_text TEXT NOT NULL`
- `response_text TEXT`
- `provider_id TEXT`
- `model_id TEXT`
- `external_ai_used INTEGER NOT NULL` CHECK in (0,1)
- `policy_decision TEXT NOT NULL` CHECK in (`allowed`, `blocked`, `override`)
- `citation_count INTEGER NOT NULL DEFAULT 0` CHECK >= 0
- `provenance_record_id TEXT` FK -> `provenance_records.id` (nullable)
- `created_by TEXT NOT NULL`
- `created_at_utc TEXT NOT NULL`

## Index Strategy
- `projects(workspace_id, status)` for scoped project listings.
- `artifacts(project_id, created_at_utc DESC)` for latest artifact views.
- `artifacts(sha256)` for hash lookup and dedupe checks.
- `provenance_records(project_id, artifact_id, captured_at_utc)` for trace queries.
- `audit_log(project_id, event_ts_utc)` for chronological audit scans.
- `audit_log(project_id, entity_type, entity_id, event_ts_utc)` for entity-focused audits.
- `ai_queries(project_id, created_at_utc DESC)` for query history.
- `ai_queries(project_id, external_ai_used, created_at_utc)` for policy reporting.

## FK Rules
- All foreign keys are enforced with `PRAGMA foreign_keys=ON`.
- Delete behavior is restrictive by default (`ON DELETE RESTRICT`) to prevent silent evidence loss.
- Optional links use `ON DELETE SET NULL` only where historical row retention is required (for `ai_queries.provenance_record_id`).
- Update behavior uses `ON UPDATE CASCADE` on key relationships to preserve integrity if IDs are ever normalized.

## WAL Mode Notes
- WAL is applied in migration `0002_wal_settings.sql` using PRAGMA statements.
- `journal_mode=WAL` is database-level persistent for SQLite file once accepted.
- `synchronous=NORMAL` and `wal_autocheckpoint` are connection-level behaviors and should also be set at runtime open-hook for deterministic startup behavior.

## Definition of Done
- All required tables exist with explicit constraints and foreign keys.
- Indexes cover project-scoped retrieval, audit scans, and hash lookup.
- Migration set includes schema initialization and WAL configuration step.
- Migration runner applies files in deterministic order and records applied migrations atomically.

## Tests
Unit:
- Validate migration ordering logic and duplicate-apply skip behavior.
- Validate transactional application records migration only when SQL succeeds.
- Validate schema_version read/write behavior.

Manual:
1. Apply migrations on a fresh DB and confirm all required tables exist.
2. Re-run migrations and confirm no duplicate schema_version rows are created.
3. Force a failing migration and confirm no schema_version record is written for the failed migration.
4. Query `PRAGMA journal_mode;` and confirm `wal`.
5. Attempt invalid FK insert and confirm failure with foreign key error.