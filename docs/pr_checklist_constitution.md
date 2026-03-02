# PR Checklist: Constitution Conformance

Use this checklist for every PR. Any unchecked mandatory item is a merge blocker.

## Identity and Scope
- [ ] PR does not expand Phase 1 into disallowed compliance claims or cloud-dependent core workflows.
- [ ] Changes align with primary identity: Hybrid enterprise platform.

## Data Posture
- [ ] Core code remains local-first; no cloud coupling introduced in core modules.
- [ ] Local SQLite remains system-of-record for authoritative writes.
- [ ] External AI paths remain restricted by default or include approved, time-bounded override audit event.
- [ ] Litigation-defensible requirements remain intact (immutability, audit chain, provenance).

## Boundaries
- [ ] UI does not access filesystem APIs directly.
- [ ] UI does not call model APIs directly.
- [ ] Storage access uses `ObjectStore` interface only.
- [ ] Service-layer queries are scoped by `ProjectContext`.

## Non-Negotiables
- [ ] No cross-client leakage path introduced.
- [ ] Citations present for non-trivial generated claims.
- [ ] Deliverable/version handling is append-only for immutable outputs.
- [ ] Hash-addressed artifact identity preserved.
- [ ] Secrets are not stored in plaintext.
- [ ] Fail-closed behavior exists for policy/schema/signature violations.

## Evidence
- [ ] PR description includes conformance notes for constitution sections touched.
- [ ] Tests or manual verification evidence attached for boundary, audit, and provenance checks.