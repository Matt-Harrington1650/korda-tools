# KORDA Architecture Constitution (v1)

## 1) Product Identity (Binding)
- [ ] Desktop productivity tool
- [ ] Firm knowledge infrastructure layer
- [ ] Compliance + AI platform
- [x] Hybrid enterprise platform

Binding decisions:
- Primary identity: Hybrid enterprise platform.
- Allowed secondary roles: Desktop productivity tool, firm knowledge infrastructure layer.
- Explicitly disallowed Phase 1 scope: Compliance platform claims, autonomous legal/compliance determinations, cross-tenant analytics, cloud-dependent core workflows.

## 2) Data Posture (Binding Decisions)
- Local-first with cloud-ready abstraction: REQUIRED.
- Cloud-ready definition: Core domain and persistence modules MUST depend only on adapter interfaces; cloud providers MUST be replaceable adapter implementations; no cloud SDK imports in core domain modules.
- System-of-record selection: Local system-of-record.
- Implications (exactly 3):
1. All authoritative writes MUST commit to local SQLite before any replication attempt.
2. Cloud services MAY consume replicated events but MUST NOT mutate authoritative local state directly.
3. Offline operation for all Phase 1 critical paths (create/read/update/run/audit) is REQUIRED.
- External AI default: RESTRICTED by default.
- Controls: Provider allowlist, project-level opt-in, credential vault requirement, request/response logging with citation metadata, policy gate before outbound calls.
- Override path: Security owner + project owner dual approval recorded as immutable audit event with expiration date.
- Defensibility selection: Litigation-defensible.
- Minimum defensibility requirements: Immutable append-only records, cryptographically linked audit trail, per-deliverable provenance with source citations and version timestamps.

## 3) Non-Negotiables
- No cross-client data leakage under any execution mode.
- Citations are required for every non-trivial generated claim or recommendation.
- Immutable deliverables are append-only; corrections require superseding versions.
- Object storage uses hash-addressed identifiers for immutable artifacts.
- Every state-changing operation emits an audit-chain event with previous-hash linkage.
- Provenance metadata is mandatory for artifacts and deliverables.
- Secrets are never stored in plaintext in SQLite or logs.
- All service-layer queries are scoped by ProjectContext.
- Fail-closed behavior is required on policy, schema, or signature validation failure.
- No direct model/API calls from UI code paths.

## 4) Interfaces & Boundaries
- UI cannot access filesystem directly.
- UI cannot call model APIs directly.
- All storage via `ObjectStore` interface.
- All queries scoped by `ProjectContext` at service layer.

## 5) Phase Gates (No-go)
- No AI feature expansion before Data Substrate exit criteria pass.
- No cloud sync before governance/audit/immutability pass.

## 6) Definitions (Canonical Terms)
- Workspace: Top-level local container for one or more projects, settings, and policies.
- Project: Isolated security and data boundary for artifacts, runs, and access decisions.
- Artifact: Immutable stored object addressed by content hash.
- Deliverable: User-facing output package derived from artifacts and execution records.
- Version: Monotonic identifier for a project entity or deliverable revision.
- Provenance: Verifiable lineage of inputs, transformations, actors, and tools used.
- Audit Event: Append-only, timestamped record of a state-changing action with actor and hash link.
- Experience Record: Structured outcome record capturing task context, decisions, evidence, and result quality.
- External AI: Any model inference service executing outside the local trusted runtime.
- Citation: Machine-readable reference to a source artifact, document, or external record supporting a claim.

## 7) Decision Register
| Decision ID | Decision | Date | Owner | Rationale | Revisit Trigger |
|---|---|---|---|---|---|
| D-001 | Local-first with cloud-ready abstraction is mandatory. | 2026-03-02 | Architecture | Minimizes dependency risk while preserving future deployment options. | Core module requires direct cloud SDK dependency. |
| D-002 | Local SQLite is system-of-record; cloud is advisory/replication only. | 2026-03-02 | Architecture | Preserves offline authority and deterministic recovery. | Need for multi-region authoritative writes. |
| D-003 | External AI is restricted by default with controlled override. | 2026-03-02 | Security + Architecture | Reduces data-exfiltration and compliance exposure. | Regulatory policy update or contractual allowance change. |
| D-004 | Litigation-defensible posture is mandatory. | 2026-03-02 | Governance | Requires evidentiary quality for disputes and audits. | Legal counsel issues revised evidentiary standard. |

## Definition of Done
- All decisions in Sections 1-7 are treated as binding constraints for design, implementation, and review.
- Every new or changed subsystem documents conformance to Sections 2-5 before merge.
- PR reviewers use `/docs/pr_checklist_constitution.md` and block merge on any unchecked mandatory item.

## Tests (Manual Verification Steps)
1. Confirm all storage calls route through `ObjectStore` interface with no bypass.
2. Confirm UI modules contain no filesystem API usage and no direct model/provider SDK calls.
3. Confirm service methods require `ProjectContext` and enforce project scoping in queries.
4. Confirm audit events are append-only and hash-linked for each state-changing operation.
5. Confirm at least one deliverable includes provenance and citations with version timestamps.
6. Confirm external AI calls are blocked by default unless dual-approval override exists and is unexpired.
7. Confirm cloud sync paths do not execute when governance/audit/immutability gate status is incomplete.