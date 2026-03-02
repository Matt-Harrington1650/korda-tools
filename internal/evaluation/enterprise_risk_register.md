# Executive Risk Register

## Definition of Done
- Every High/Critical finding from stress evaluation is represented.
- Risks are operationally plausible and evidence-backed.
- Mitigation plans include concrete control work and target dates.

## Tests
1. Cross-check against defects in `internal/evaluation/stress_test_report.md`.
2. Cross-check against matrix high/critical rows in `internal/evaluation/enterprise_comparison_matrix.md`.

## Findings (severity-ranked)
- Critical
  - R-001 project boundary bypass in finalize/integrity operations.
- High
  - R-002 frontend direct model/API egress without centralized governance.
  - R-003 AI policy contract not runtime enforced.
  - R-004 migration runtime ambiguity from unimplemented secondary runner path.
  - R-005 incomplete classification enforcement on downstream control points.
- Medium
  - R-006 release tag/governance mismatch.
  - R-007 placeholder CODEOWNERS ownership.
  - R-008 runbook evidence not operationalized in CI/drills.

## Evidence
| Risk ID | Description | Exploit/Failure Mode | Impact | Likelihood | Severity | Existing Controls | Missing Controls | Owner | Mitigation Plan | Target Date |
|---|---|---|---|---|---|---|---|---|---|---|
| R-001 | Cross-project boundary bypass in finalize/integrity paths | Actor with known artifact ID from Project A calls finalize/verify under Project B scope; operation succeeds against Project A artifact | Cross-client leakage, unauthorized record finalization, legal exposure | Medium | Critical | Scope validation and project-scoped list queries in records service | Project binding at artifact lookup/enforcement point | App Platform Lead | Require project-scoped artifact lookup for finalize/version/verify APIs; add deny+audit tests in CI | 2026-03-09 |
| R-002 | Frontend direct model/API egress bypasses centralized governance | UI execution path issues outbound fetch directly to tool/model endpoints | Data exfiltration, non-compliant AI usage, missing enterprise audit decisions | High | High | Tool execution logs and adapter validation | Backend AI gateway with policy allow/deny/override and immutable decision logging | AI Platform Lead | Move model/provider egress to backend command gateway; block direct frontend provider fetch for governed tool types | 2026-03-16 |
| R-003 | AI response contract (citation/confidence/coverage) not enforced | Non-trivial responses can be emitted without citations/confidence/coverage thresholds or review triggers | Hallucination risk, unsafe decisions, weak legal defensibility | High | High | Policy docs and schema placeholders (`ai_queries` columns) | Runtime contract validation and review trigger enforcement | AI Governance Owner | Define typed response envelope and hard-fail non-compliant responses; enforce review triggers by policy | 2026-03-16 |
| R-004 | Migration authority ambiguity due secondary runner TODOs | Teams may assume TS migration path is production-ready; incomplete implementation diverges from runtime authority | Migration drift, failed startup paths, unclear rollback/forward-fix strategy | Medium | High | Tauri runtime migration chain + migration authority doc | Full integration or retirement of secondary migration path with CI guardrails | Platform Engineering | Finalize single authority decision in code; either wire `openSqlite` path or remove path + add CI drift checks | 2026-03-12 |
| R-005 | Classification controls not fully enforced downstream | Sensitivity captured at ingest but not consistently evaluated during query/export/AI egress | Confidential/client data exposure through unauthorized channels | Medium | High | Ingest type/sensitivity fields and DB CHECK constraints | Central policy enforcer at read/query/export/AI boundaries | Security Architect | Implement classification policy middleware and audit denied/override events | 2026-03-19 |
| R-006 | Release tag governance mismatch | Workflow creates `app-v__VERSION__` while governance/changelog expect `vX.Y.Z` | Broken release traceability and automation confusion | Medium | Medium | Governance doc + release workflow both exist | Unified semantic tagging policy enforced in workflow/CI | Release Manager | Align workflow tagName to `v__VERSION__`; add CI validation for version/tag/changelog consistency | 2026-03-08 |
| R-007 | Placeholder CODEOWNERS weakens control ownership | No real team/account mapped for mandatory review paths | Review accountability gaps, uncontrolled critical changes | Medium | Medium | CODEOWNERS file structure exists | Real owners and enforcement in branch protection | Engineering Manager | Replace placeholders with actual users/teams; verify auto-review requests on PR | 2026-03-06 |
| R-008 | Operational runbooks exist but drill evidence not automated | Backup/restore/audit verification steps not continuously validated | Incident recovery confidence low under real outage/tamper event | Medium | Medium | Runbook docs under `docs/operations/` | Scheduled drill execution, evidence retention, CI checks for freshness | SRE Lead | Add quarterly drill pipeline artifacts (restore counts/hash/audit continuity), attach reports to releases | 2026-03-29 |


