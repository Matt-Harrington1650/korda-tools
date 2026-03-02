# Go-Live Readiness Signoff (v1)

## Header
- Target Environment:
- Release Version:
- Build Artifact:
- Installer SHA256:
- Planned Go-Live UTC:
- Change Owner:

## Readiness Checklist
- [ ] OP-01 to OP-17 acceptance script passed on staging.
- [ ] Restore drill completed within last 30 days.
- [ ] Incident response runbook acknowledged by Admin and Project Owners.
- [ ] Legal hold and retention runbook acknowledged by Admin and Project Owners.
- [ ] Approved role matrix applied with least privilege.
- [ ] External AI override policy enforced with mandatory expiry.
- [ ] Release evidence includes version + checksum + scope owner.
- [ ] P0/P1 open issues count = 0.

## Risk Register Snapshot
| Risk ID | Severity | Status | Mitigation Owner | Residual Risk Accepted? |
|---|---|---|---|---|

## Approvals
- Admin Approval (Name/UTC):
- Project Owner Approval (Name/UTC):
- Security Approval (Name/UTC):
- Operations Approval (Name/UTC):

## Final Decision
- [ ] Approved for Go-Live
- [ ] Blocked

Blocking Reasons (if blocked):

## Definition of Done
- Checklist is fully completed with explicit approval decisions.
- Any blocked item has documented owner and target remediation date.

## Tests
1. `rg -n "Readiness Checklist|Approvals|Final Decision" internal/operations/go_live_readiness_signoff_v1.md`
2. `rg -n "Definition of Done|## Tests" internal/operations/go_live_readiness_signoff_v1.md`
