# Migration Authority (v1)

## Decision
The authoritative runtime migration chain is `src-tauri/migrations` executed via `sql_migrations()` in `src-tauri/src/lib.rs`.

## Rationale
- Tauri startup already executes this chain on every application boot.
- Keeping one runtime source of truth avoids split-brain schema evolution.
- Existing migration tracking conventions in this runtime are aligned to versioned SQL migration entries.

## Schema Tracking Table
- Runtime tracking remains centered on migration versions (table: `migrations`, created in `0005_create_migrations_table.sql`).
- New governance/storage schema additions are introduced as new migration versions (`0015+`).

## Relationship to Root `/migrations`
- Root `/migrations` files are design/reference artifacts and non-authoritative until explicitly ported into `src-tauri/migrations`.
- Any schema change must be merged into Tauri runtime chain before release.
- `src/services/db/migrate.ts` and `src/services/db/sqlite.ts` are non-authoritative experimental adapters and must not be used for production app bootstrap.

## Required Process
1. Author migration SQL under `src-tauri/migrations` with new monotonically increasing version.
2. Add migration entry in `sql_migrations()` with matching version/description/file.
3. Add/adjust migration integrity tests.
4. Run startup migration validation on fresh and existing DB snapshots.

## Definition of Done
- New schema changes are represented in `src-tauri/migrations` and referenced in `lib.rs`.
- Migration tests verify ordering and presence of required versions.
- Fresh and repeat startup validation pass.

## Tests
- `rg -n "0015_create_governance_core.sql|0016_create_deliverables.sql|0017_harden_audit_chain.sql|0018_create_sheet_knowledge_tables.sql|0019_create_policy_controls.sql|0020_add_ai_review_fields.sql" src-tauri/src/lib.rs`
- `cargo test --manifest-path src-tauri/Cargo.toml`
