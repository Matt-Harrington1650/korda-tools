# Audit Chain Specification (v1)

## Minimum Audit Events
Required event types:
- `artifact.ingested`
- `artifact.integrity.verified`
- `deliverable.finalized`
- `deliverable.version.created`
- `ai.query.executed`
- `ai.query.blocked`
- `policy.updated`
- `retention.policy.updated`
- `object.gc.started`
- `object.gc.deleted`
- `object.gc.completed`
- `auth.override.granted`
- `auth.override.revoked`
- `system.migration.applied`

## Hash-Chain Scheme
Chain formula:
- `this_hash = sha256(prev_hash + canonical_payload)`
- `prev_hash` is the previous event hash within the same project chain.
- `canonical_payload` is deterministic JSON from the event payload (stable key ordering).

Event fields required for canonical payload:
- `workspace_id`
- `project_id`
- `actor_id`
- `action`
- `entity_type`
- `entity_id`
- `event_ts_utc`
- `metadata` (object; canonicalized)

## Canonical Serialization Rules
- Objects are serialized with lexicographically sorted keys.
- Arrays preserve input order.
- Primitive rendering uses JSON standard encoding.
- No undefined values are serialized; omit missing keys.
- Timestamps use UTC ISO-8601 strings.
- Canonical payload bytes are UTF-8 prior to hashing.

## Tamper Evidence vs Prevention
- Tamper evidence: hash-chain verification detects historical modifications, deletions, or insertion gaps.
- Tamper prevention: DB immutability controls (no update/delete triggers) prevent direct mutation attempts.
- Both are required: prevention reduces attack surface, evidence supports post-incident proof.

## Optional Future Enhancements
- Signing: per-event digital signatures using key rotation policy.
- Timestamping: trusted timestamp authority anchoring for external non-repudiation.
- Cross-chain anchoring: periodic root hash publication to immutable external ledger.

## DB Additions (`migrations/0004_audit_chain.sql`)
Added columns to `audit_log`:
- `canonical_payload_json TEXT NOT NULL DEFAULT '{}'`
- `hash_algorithm TEXT NOT NULL DEFAULT 'sha256'`
- `chain_version INTEGER NOT NULL DEFAULT 1`

Added controls:
- Immutable triggers to block `UPDATE` and `DELETE` on `audit_log`.
- Chain scan index on `(project_id, event_ts_utc, id)`.

Why:
- Persisting canonical payload ensures deterministic recomputation.
- Explicit algorithm/version enables future chain evolution.
- Triggers enforce append-only behavior at DB layer.

## Definition of Done
- Audit service appends hash-linked events using canonical serialization.
- Chain verification reports first broken event with reason.
- Audit export supports at least `json`, `jsonl`, and `csv`.
- DB enforces append-only audit rows.

## Tests
Unit:
- Stable serializer outputs identical JSON for equivalent objects with different key insertion order.
- appendAuditEvent computes `this_hash` from `prev_hash + canonical_payload`.
- verifyAuditChain detects modified payload/hash and reports failing event id.
- exportAuditLog returns valid payload for `json`, `jsonl`, `csv`.

Manual:
1. Append at least three audit events and verify chain passes.
2. Manually tamper with one event hash in DB and verify chain check fails.
3. Attempt `UPDATE audit_log` and `DELETE FROM audit_log`; confirm trigger aborts.
4. Export logs in all formats and validate record counts match.