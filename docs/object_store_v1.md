# Object Store Specification (v1)

## Goals
- Dedupe: identical binary payloads resolve to the same `sha256` object id.
- Immutability support: once an object is committed, content cannot be overwritten.
- Cloud-ready adapters: storage implementation is behind interfaces so local disk and cloud backends are swappable.

## Object Key Scheme
- Canonical object key format: `/objects/aa/<sha256hex>`.
- `aa` is the first two hex characters of the object hash (directory sharding).
- Example:
- Hash: `9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08`
- Key: `/objects/9f/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08`

## Metadata Strategy (DB)
- Binary payload is stored in object storage only.
- Metadata is stored in SQLite (or equivalent repository) and includes:
- `object_hash` (`sha256`), `object_key`, `size_bytes`, `mime_type`, `original_name`, `project_id`, `created_at_utc`, `created_by`.
- Metadata writes are performed by service layer after successful immutable object put.
- Metadata records are append/update-safe by policy, but object content is immutable.

## Read-Only Retrieval Contract
- Retrieval is read-only by hash (`sha256`) and project context.
- If hash exists, returned bytes MUST match hash verification.
- If hash does not exist, return typed not-found error.
- No write-on-read behavior is allowed.

## Garbage Collection Rules
Allowed:
- Remove unreferenced objects only when reference count is zero and retention policy permits.
- Soft-delete metadata pointers before physical object purge when policy requires hold periods.
- GC must append audit events for scan/start/delete/complete phases.

Forbidden:
- Deleting objects referenced by active deliverables, legal hold, or retention locks.
- Mutating object bytes in place.
- Running GC outside service-layer authorization and project boundary checks.

## Strict Rule Set
- UI must not call filesystem directly.
- Only service layer calls `ObjectStore`.
- All writes go through `ObjectStoreService` as the single write entry point.

## Refactor Plan: UI FS Calls -> Service Routing
Typical anti-patterns and routing target:
- UI calls `readFile`/`writeFile` -> route to `ObjectStoreService.put` and service retrieval methods.
- UI computes hash client-side and writes path directly -> route hash+write flow through `fileIngest` + `ObjectStore` adapter.
- UI persists object metadata directly -> route to service layer metadata writer after successful object put.
- UI invokes model with local file path -> route to ingestion first, then pass artifact hash/id to orchestrator.

## Checklist: Prove No FS Calls In UI Layer
- [ ] `rg "from 'fs'|from \"fs\"|readFile|writeFile|createReadStream|createWriteStream" src/pages src/components src/features`
- [ ] Verify zero direct filesystem imports/usages in UI-rendered modules.
- [ ] Verify all object writes originate in `ObjectStoreService.put`.
- [ ] Verify service methods require project context before storage operations.

## Definition of Done
- This spec is committed at `/docs/object_store_v1.md`.
- Object key scheme and sharding rule are explicitly defined and implemented by resolver.
- Service-only write rule is encoded in architecture and code structure.
- Object immutability and retrieval contract are represented in interfaces and adapters.
- GC allowed/forbidden rules are documented and enforceable by policy.

## Tests
Unit:
- Verify `sha256` helper returns deterministic 64-char lowercase hex.
- Verify path resolver maps hash `ab...` to `/objects/ab/<hash>`.
- Verify local adapter rejects invalid hash and disallows overwrite.
- Verify `ObjectStoreService.put` writes metadata and appends audit event on success.
- Verify typed error mapping for not-found and policy-denied scenarios.

Manual:
1. Ingest same file twice; confirm same hash and same object key.
2. Attempt overwrite for existing hash; confirm operation is idempotent and bytes unchanged.
3. Query metadata table for ingested object; confirm hash/key/size/mime/project are present.
4. Run UI grep checklist and confirm no filesystem usage in UI layer.
5. Perform retrieval by hash and verify returned content hash matches requested hash.