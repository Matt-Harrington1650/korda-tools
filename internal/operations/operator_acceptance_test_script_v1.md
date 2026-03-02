# Operator Acceptance Test Script (v1)

Run on staging endpoint prior to production go-live.

## Header
- Run Date (UTC):
- Endpoint:
- Operator:
- Reviewer:
- App Version:

## Test Matrix

| ID | Scenario | Preconditions | Steps | Expected Result | Pass/Fail | Evidence |
|---|---|---|---|---|---|---|
| OP-01 | Scope bootstrap | Fresh scope | Open new scope with designated owner actor | Owner operational as `project_owner` |  |  |
| OP-02 | Grant publisher role | Owner actor active | Grant `records_publisher` via Policy Administration | Binding appears + `policy.role.granted` |  |  |
| OP-03 | Standard ingest success | Publisher role active | Ingest Internal artifact | Artifact stored + hash visible + `artifact.ingested` |  |  |
| OP-04 | Client-confidential ingest denied | Publisher role only | Ingest Client-Confidential artifact | Deny + `policy.denied` |  |  |
| OP-05 | Client-confidential ingest allowed | Owner role active | Ingest Client-Confidential artifact | Success |  |  |
| OP-06 | Finalize denied by role | Viewer role active | Attempt finalize | `POLICY_ROLE_REQUIRED_FOR_FINALIZE` |  |  |
| OP-07 | Finalize success | Publisher role active | Finalize valid artifact | Deliverable v1 + `deliverable.finalized` |  |  |
| OP-08 | Version overwrite blocked | Deliverable exists | Create new version with same hash artifact | `DELIVERABLE_VERSION_HASH_UNCHANGED` |  |  |
| OP-09 | Version append success | New artifact available | Create new version with new hash + reason | Version increments, old versions preserved |  |  |
| OP-10 | Cross-project block | Known foreign IDs | Attempt operation across project scope | `PROJECT_SCOPE_VIOLATION` or `DELIVERABLE_SCOPE_MISMATCH` |  |  |
| OP-11 | Integrity verify success | Known-good artifact | Run `Verify` | `Valid` |  |  |
| OP-12 | External AI context denied | OpenAI-compatible tool | Run without governance context | `EXTERNAL_AI_CONTEXT_REQUIRED` |  |  |
| OP-13 | External AI override denied | Context present, no override | Run tool | `EXTERNAL_AI_DEFAULT_DENY` |  |  |
| OP-14 | Provider mismatch denied | Context + wrong providerId | Run tool | `EXTERNAL_AI_PROVIDER_MISMATCH` |  |  |
| OP-15 | External AI allowed path | Role + valid override + host match | Run tool | Request proceeds |  |  |
| OP-16 | AI contract enforcement | Provider returns incomplete response | Run tool | `AI_POLICY_CONTRACT_VIOLATION` |  |  |
| OP-17 | Audit review | Prior tests executed | Review audit event stream | Complete action/deny sequence visible |  |  |

## Gate Rule
- All OP tests must pass for go-live readiness.
- Any failed OP test blocks go-live until remediated and retested.

## Signoff
- Operator:
- Reviewer:
- Final Status (Ready/Blocked):
- Signoff UTC:

## Definition of Done
- OP-01 through OP-17 executed with evidence references.
- Any failure includes defect ticket and rerun result.

## Tests
1. `rg -n "OP-01|OP-17|Final Status" internal/operations/operator_acceptance_test_script_v1.md`
2. `rg -n "Gate Rule|Definition of Done|## Tests" internal/operations/operator_acceptance_test_script_v1.md`
