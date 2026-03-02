# KORDA Tools Production Operations Plan (v1)

## Brief Summary
This runbook defines day-to-day production operation of KORDA Tools for Windows desktop endpoints with local SQLite and local object storage, under fail-closed governance controls.

## Assumptions and Defaults (Binding)
1. Deployment model: Windows desktop app (`Tauri + React`) installed per managed endpoint.
2. Data locality: local SQLite and local object storage are authoritative for that endpoint.
3. Identity policy: `actorId` maps to a real human identity; shared identities are prohibited.
4. Scope policy: every governed action includes `workspaceId`, `projectId`, and `actorId`.
5. Bootstrap default: first actor opening a new project scope becomes `project_owner`; this action is admin-controlled.
6. Role model: allowed roles are `project_owner`, `records_publisher`, `records_viewer`, `ai_operator`.
7. External AI default: deny unless role + override + governed context pass.
8. Override safety default: production overrides require expiry; default max window is 7 days.
9. Classification default: artifact ingest requires explicit sensitivity.
10. Authority rule: AI output is advisory and never authoritative record.
11. Immutability rule: finalized deliverables are append-only.
12. Audit rule: policy denies and governance actions are reviewed daily.
13. Time standard: operations evidence is tracked in UTC.
14. Liability posture: block uncertain actions and escalate to `project_owner` and Admin.

## Operator-Facing Types and Entry Points
- Governance context: `workspaceId`, `projectId`, `actorId`, `sensitivityLevel`, optional `providerId`, optional `externalAiOverrideId`
- Sensitivity enum: `Public`, `Internal`, `Confidential`, `Client-Confidential`
- Role enum: `project_owner`, `records_publisher`, `records_viewer`, `ai_operator`
- Common enforcement outcomes: `POLICY_*`, `PROJECT_SCOPE_VIOLATION`, `DELIVERABLE_SCOPE_MISMATCH`, `EXTERNAL_AI_*`, `AI_POLICY_CONTRACT_VIOLATION`
- UI entry points:
  - `Records Governance`
  - `Policy Administration`
  - `Tool Detail > Execution > Governance Context`

## Required/Recommended/Forbidden Action Standard
- `Required`: mandatory for compliant operation.
- `Recommended`: best-practice control, may be deferred with written rationale.
- `Forbidden`: prohibited in production.

## Role-Based Operating Procedures

| Role | Required | Recommended | Forbidden |
|---|---|---|---|
| Admin | Control installer distribution, assign bootstrap owners, enforce endpoint baseline, run backup/restore and incident runbooks, audit role/override hygiene weekly | Monthly access recertification and tabletop drills | Performing project content operations under user identities |
| Project Owner | Approve scope, grant/review roles, approve/review external AI overrides, approve finalization exceptions | Weekly audit sampling and override expiry cleanup | Granting indefinite external AI overrides |
| Records Publisher | Ingest artifacts, finalize deliverables, create new versions with reasons, maintain metadata quality | Integrity checks before and after finalization | Finalizing without reason or outside project scope |
| Records Viewer | Read-only review, integrity verification, audit monitoring | Report policy anomalies same day | Ingest/finalize/version operations |
| AI Operator | Run governed AI executions with valid context and approved override | Validate citations/confidence/coverage before sharing outputs | External AI without context or override, or treating AI output as record |

## Step-by-Step Workflows

### 1) Initial Setup
1. Required: Install signed production build on managed Windows endpoint.
2. Required: Launch app and verify startup without migration errors.
3. Required: Confirm operator identity mapping for `actorId`.
4. Required: Admin records endpoint, owner, and deployment timestamp.
5. Recommended: Run one smoke ingest and one audit review.
6. Forbidden: Shared service accounts as `actorId`.

### 2) Create/Select Workspace and Project Scope
1. Required: Open `Records Governance`.
2. Required: Set `Workspace ID`, `Project ID`, `Actor ID`.
3. Required: Verify scope before any write action.
4. Recommended: Maintain scope naming registry.
5. Forbidden: Reusing another team scope identifiers.

### 3) Ingest Artifact
1. Required: Choose file via governed picker.
2. Required: Set `artifactType`, `discipline`, `status`, `sensitivityLevel`.
3. Required: Ensure filename conforms to policy.
4. Required: Click `Ingest Artifact` and confirm artifact/hash response.
5. Required: Confirm artifact row shows immutable indicator.
6. Recommended: Run immediate integrity check for high-value records.
7. Forbidden: Client-confidential ingest without required owner role.

### 4) Finalize Deliverable
1. Required: Select artifact in current scope.
2. Required: Click `Finalize` with explicit reason.
3. Required: Confirm deliverable creation at `v1`.
4. Required: Verify `deliverable.finalized` audit event.
5. Recommended: Second-person review for critical artifacts.
6. Forbidden: Finalizing `ai_output` as authoritative record.

### 5) Create New Version
1. Required: Select target deliverable.
2. Required: Select a new artifact and change reason.
3. Required: Click `Create New Version` and confirm `v2+`.
4. Required: Confirm prior versions remain unchanged.
5. Forbidden: Versioning with unchanged hash.

### 6) Verify Artifact Integrity
1. Required: Click `Verify`.
2. Required: Expect `Valid`; if mismatch, stop downstream use.
3. Required: Escalate mismatch with artifact ID/hash to Admin + Project Owner.
4. Recommended: Weekly integrity sampling on high-risk records.
5. Forbidden: Finalize/version after hash mismatch.

### 7) Grant Role
1. Required: Open `Policy Administration > Grant Project Role`.
2. Required: Enter target `Actor ID` and role.
3. Required: Click `Grant Role`.
4. Required: Confirm role appears in `Project Role Bindings`.
5. Required: Confirm `policy.role.granted` audit event.
6. Recommended: Apply least privilege and monthly recertification.
7. Forbidden: Granting `project_owner` without approval trail.

### 8) Grant External AI Override
1. Required: Open `Policy Administration > Grant External AI Override`.
2. Required: Enter `Actor ID`, `Provider ID`, `Sensitivity`, `Reason`, and expiry.
3. Required: Click `Grant Override`.
4. Required: Confirm override in `External AI Overrides`.
5. Required: Confirm `policy.override.granted` audit event.
6. Recommended: Short expiry and explicit renewal reason.
7. Forbidden: No-expiry overrides in production.

### 9) Run OpenAI-Compatible Tool with Governance Context
1. Required: Open `Tool Detail` for `openai_compatible` tool.
2. Required: Populate governance context fields.
3. Required: Set `providerId` to outbound host and supply valid override ID where required.
4. Required: Run through governed execution.
5. Required: Validate citation/confidence/coverage/newest-source fields on success.
6. Required: Mark review-required outputs for human review before distribution.
7. Forbidden: External AI execution without context and approved override.

### 10) Review Audit Events
1. Required: Review `Recent Audit Events` daily.
2. Required: Check `policy.denied`, finalize/version, role/override grant events.
3. Required: Investigate unexpected deny spikes same day.
4. Recommended: Weekly evidence export/snapshot.
5. Forbidden: Ignoring recurring policy denials.

## Daily / Weekly / Monthly Operational Checklists

### Daily
- Required: verify active scope and actor identity.
- Required: review policy deny events.
- Required: check overrides expiring in 24h.
- Required: confirm backup success signal.
- Recommended: one sampled integrity verification on active high-risk artifact.
- Forbidden: carrying unresolved critical policy denies into next day.

### Weekly
- Required: review role grants and remove stale access.
- Required: review active overrides and prune unnecessary entries.
- Required: confirm append-only version behavior on sampled deliverable.
- Recommended: execute full operator acceptance script on one pilot project.
- Recommended: produce weekly governance evidence packet.
- Forbidden: leaving expired overrides active.

### Monthly
- Required: execute backup/restore drill and verify hash/audit continuity.
- Required: run cross-project leakage tabletop exercise.
- Required: perform role recertification.
- Required: review retention/legal hold outcomes.
- Recommended: refresh training from recent incidents/defects.
- Forbidden: skipping restore drills for two consecutive months.

## Go-Live Readiness Criteria
- Required: OP-01 through OP-17 acceptance tests pass on staging endpoint.
- Required: restore drill completed within prior 30 days.
- Required: incident and legal-hold runbooks acknowledged by Admin and Project Owners.
- Required: approved least-privilege role matrix in effect.
- Required: external AI override policy enforced with expiry.
- Required: release version and installer checksum recorded in release evidence.
- Recommended: one-week pilot with two projects before full rollout.
- Forbidden: go-live with unresolved critical policy/audit/immutability defects.

## Training Rollout (Week 1 to Week 4)
- Week 1: Admin + Owners complete scope/role/override training and fail-closed posture review.
- Week 2: Publishers/Viewers complete ingest/finalize/version/integrity/audit workflows.
- Week 3: AI Operators complete governed context + override + deny-path troubleshooting.
- Week 4: Full OP-01 to OP-17 run, monthly checklist simulation, and formal signoff.

## Referenced Execution Artifacts
- `internal/operations/operator_acceptance_test_script_v1.md`
- `internal/operations/operations_execution_log_template_v1.md`
- `internal/operations/go_live_readiness_signoff_v1.md`
- `internal/operations/training_rollout_execution_pack_v1.md`
- `docs/operations/operator_error_handling_matrix_v1.md`

## Definition of Done
- Operations plan is committed and scoped to current enforced runtime behavior.
- Required/recommended/forbidden actions are explicit across roles and workflows.
- Operator execution artifacts exist for acceptance tests, go-live signoff, and training evidence.

## Tests
1. `rg -n "KORDA Tools Production Operations Plan|Required|Forbidden|Go-Live" docs/operations/korda_tools_production_operations_plan_v1.md`
2. `rg -n "OP-01|OP-17|policy.denied|EXTERNAL_AI_DEFAULT_DENY" docs/operations internal/operations`
3. `rg -n "Definition of Done|## Tests" docs/operations/korda_tools_production_operations_plan_v1.md`
