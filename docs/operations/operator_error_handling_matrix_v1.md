# Operator Error Handling Matrix (v1)

## Matrix

| Error Code / Message | Likely Cause | Required Operator Action |
|---|---|---|
| `WORKSPACE_REQUIRED` / `PROJECT_REQUIRED` / `ACTOR_REQUIRED` | Scope identifiers missing | Populate required scope fields and retry |
| `POLICY_ROLE_REQUIRED_FOR_INGEST` | Actor lacks ingest permission | Request `records_publisher` or `project_owner` role |
| `POLICY_CLIENT_CONFIDENTIAL_INGEST_OWNER_REQUIRED` | Non-owner ingesting client-confidential artifact | Escalate to `project_owner` |
| `FILENAME_POLICY_REJECTED` | Filename violates naming policy | Rename artifact and re-ingest |
| `INGEST_EMPTY_FILE` | Empty artifact payload | Re-export/reacquire source artifact |
| `OBJECT_STORE_*` | Local object storage failure | Stop write operations and escalate to Admin |
| `PROJECT_SCOPE_VIOLATION` | Cross-project operation attempted | Verify workspace/project scope and target IDs |
| `DELIVERABLE_SCOPE_MISMATCH` | Deliverable/artifact in different project scope | Re-select scoped records only |
| `POLICY_ROLE_REQUIRED_FOR_FINALIZE` | Missing finalize role | Grant appropriate role or reassign |
| `ARTIFACT_AUTHORITY_REJECTED` | AI output attempted as authoritative record | Use human-issued authoritative artifact |
| `ARTIFACT_HASH_MISMATCH` | Integrity validation failed | Quarantine record and execute incident runbook |
| `DELIVERABLE_VERSION_HASH_UNCHANGED` | Attempted overwrite-style versioning | Ingest corrected artifact and create new version |
| `POLICY_ROLE_REQUIRED_FOR_VERSION` | Missing versioning role | Grant owner/publisher role |
| `POLICY_ROLE_REQUIRED_FOR_INTEGRITY` | Missing integrity-check role | Use viewer/publisher/owner role |
| `EXTERNAL_AI_CONTEXT_REQUIRED` | Missing governance context | Provide full governance context |
| `POLICY_ROLE_REQUIRED_FOR_EXTERNAL_AI` | Actor lacks external AI role | Grant `ai_operator` or use owner actor |
| `EXTERNAL_AI_PROVIDER_MISMATCH` | `providerId` does not match outbound host | Correct `providerId` and endpoint mapping |
| `EXTERNAL_AI_DEFAULT_DENY` | No active override | Grant approved override with expiry |
| `POLICY_DB_UNAVAILABLE` / `POLICY_DB_QUERY_FAILED` | Local policy DB unavailable or query error | Pause external AI, restore DB health, then retry |
| `AI_POLICY_CONTRACT_VIOLATION` | AI response missing required governance fields | Reject output and remediate provider prompt/adapter contract |
| `TS_MIGRATION_RUNNER_DISABLED` | Non-authoritative migration path invoked | Use Tauri runtime migration path only |
| `AUDIT_APPEND_FAILED` | Audit append failure | Treat as high risk, pause critical writes, escalate immediately |

## Escalation Priority
- P0: `ARTIFACT_HASH_MISMATCH`, `AUDIT_APPEND_FAILED`, `PROJECT_SCOPE_VIOLATION`, `DELIVERABLE_SCOPE_MISMATCH`
- P1: `EXTERNAL_AI_*`, `AI_POLICY_CONTRACT_VIOLATION`, `POLICY_DB_*`
- P2: Ingest/naming/input quality errors

## Definition of Done
- Error matrix aligns to currently enforced runtime error surface.
- Each error includes actionable operator remediation.

## Tests
1. `rg -n "EXTERNAL_AI_DEFAULT_DENY|POLICY_ROLE_REQUIRED_FOR_FINALIZE|AUDIT_APPEND_FAILED" docs/operations/operator_error_handling_matrix_v1.md`
2. `rg -n "PROJECT_SCOPE_VIOLATION|DELIVERABLE_SCOPE_MISMATCH|AI_POLICY_CONTRACT_VIOLATION" docs/operations/operator_error_handling_matrix_v1.md`
