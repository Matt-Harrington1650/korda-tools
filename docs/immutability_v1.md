# Immutability Model (v1)

## Definitions
- Artifact: Immutable binary/object payload referenced by `sha256` and stored once in object storage.
- Deliverable: User-facing immutable output entity that points to exactly one current finalized version.
- Version: Append-only record linking a deliverable to a specific artifact hash and parent version.

## Finalization Workflow (sha256 capture)
1. User selects a completed artifact and clicks `Finalize`.
2. Service loads artifact metadata (`artifact_id`, `project_id`, `sha256`, `object_key`).
3. Service reads object bytes by hash and recomputes `sha256`.
4. Service compares computed hash to stored hash; mismatch blocks finalization.
5. Service creates a new `deliverables` row with `current_version_no=1`.
6. Service creates `deliverable_versions` row (`version_no=1`, `artifact_hash=<sha256>`, `parent_version_id=NULL`, `change_reason`).
7. Service appends audit event containing deliverable id, version id, artifact id, and `sha256`.
8. UI renders immutable status and prevents edit/overwrite actions.

## Append-Only Version Model
- Version chain is linked through `parent_version_id` and monotonic `version_no`.
- Existing version rows are immutable (update/delete blocked by DB triggers).
- New revisions are represented by new artifact hash and new `deliverable_versions` row.
- `deliverables.current_version_no` is the pointer to latest immutable version; prior versions remain queryable.

## Enforcement Rules
Allowed:
- Create version `N+1` for an existing deliverable.
- Promote latest pointer to new version number.
- Supersede previous version with new artifact hash.

Blocked:
- Overwriting existing artifact bytes.
- Editing existing `deliverable_versions` content.
- Deleting existing versions.
- Creating new version with identical artifact hash to current version.
- Finalizing when integrity verification fails.

## Minimal UI Requirements
- Finalize button:
- Label: `Finalize Deliverable`
- Enabled only when artifact integrity check passes.
- Immutable badge:
- Show on finalized deliverable views.
- Label: `Immutable`.
- Warning copy:
- `Finalized deliverables are immutable. Create a new version to make changes.`

## DB Changes Introduced (`migrations/0003_immutability.sql`)
- New table `deliverables`:
- Tracks durable deliverable identity and latest version pointer per project.
- New table `deliverable_versions`:
- Stores append-only immutable version records linked to artifact hash.
- New triggers:
- `trg_deliverable_versions_no_update` and `trg_deliverable_versions_no_delete` prevent mutation/deletion of version rows.
- New indexes:
- Optimize project-deliverable listing and version-chain retrieval.

## Definition of Done
- Finalization path captures and verifies `sha256` before creating version rows.
- Version history is append-only and linked by parent version.
- Overwrite path is impossible in service and blocked in DB.
- UI requirements are documented and implemented in product backlog.

## Tests
Unit:
- Finalize success creates deliverable + version 1 + audit append.
- Finalize fails when computed hash differs from stored hash.
- createNewVersion creates `version_no = current + 1` with parent link.
- createNewVersion fails for same hash as current version.
- Attempted update/delete of `deliverable_versions` fails due to triggers.

Manual:
1. Finalize an artifact and confirm immutable badge appears.
2. Attempt edit-in-place of finalized version and confirm operation is blocked.
3. Create new version with different artifact hash and confirm previous version remains accessible.
4. Inspect DB: `deliverable_versions` rows are appended, not modified.
5. Verify audit contains finalize/version-create entries with artifact hash.