# Retention and Legal Hold Runbook (v1)

## Policy Execution
1. Evaluate candidate deletes by retention policy and classification.
2. Block all delete candidates with active legal hold.
3. Emit audit events for every allow/deny decision.

## Legal Hold Lifecycle
- Create hold: capture scope, reason, owner, start date.
- Review hold: periodic legal review with continuation decision.
- Release hold: documented legal approval before delete eligibility resumes.

## Safe Delete Procedure
- Soft-delete metadata pointer if policy requires.
- Delay physical object purge until hold + retention conditions pass.
- Verify no authoritative deliverable references remain.

## Definition of Done
- No held artifact can be deleted.
- Every retention decision is auditable and reproducible.

## Tests
- Attempt delete with active hold and verify hard block.
- Validate hold release requires explicit approver and audit record.