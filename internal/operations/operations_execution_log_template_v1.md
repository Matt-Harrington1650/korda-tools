# Operations Execution Log Template (v1)

Use this template for daily/weekly/monthly evidence capture.

## Header
- Date (UTC):
- Environment:
- Endpoint ID:
- Workspace ID:
- Project ID:
- Operator Name:
- Actor ID:
- Reviewer Name:

## Daily Checks
- [ ] Scope and actor identity verified
- [ ] Policy deny events reviewed
- [ ] Overrides expiring in 24h reviewed
- [ ] Backup success signal verified
- [ ] High-risk integrity sample completed

Notes:

## Weekly Checks
- [ ] Role grants reviewed and stale access removed
- [ ] Active overrides reviewed and pruned
- [ ] Append-only version behavior sampled
- [ ] OP script executed on pilot project
- [ ] Governance evidence packet prepared

Notes:

## Monthly Checks
- [ ] Restore drill executed with hash/audit continuity
- [ ] Cross-project leakage tabletop completed
- [ ] Role recertification completed
- [ ] Retention/legal-hold outcomes reviewed
- [ ] Training refresh delivered

Notes:

## Issues / Escalations
| UTC Timestamp | Severity | Error Code | Scope | Summary | Escalated To | Status |
|---|---|---|---|---|---|---|

## Signoff
- Operator:
- Reviewer:
- Signoff UTC:

## Definition of Done
- Log is complete, timestamped, and tied to real scope/actor context.
- Any P0/P1 issue is explicitly tracked in Issues/Escalations table.

## Tests
1. `rg -n "Daily Checks|Weekly Checks|Monthly Checks|Issues / Escalations" internal/operations/operations_execution_log_template_v1.md`
2. `rg -n "Definition of Done|## Tests" internal/operations/operations_execution_log_template_v1.md`
