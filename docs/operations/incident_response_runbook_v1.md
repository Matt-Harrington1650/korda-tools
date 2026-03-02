# Incident Response Runbook (v1)

## Scope
Incidents: cross-client leakage, audit-chain tamper, unauthorized export, unapproved external AI usage, classification breach.

## Severity
- Sev 1: confirmed data leakage, authority compromise, or legal exposure.
- Sev 2: control bypass attempt with no confirmed exfiltration.
- Sev 3: control degradation without active abuse.

## Response Steps
1. Detect and classify incident severity.
2. Contain impact:
- Disable affected feature flag (AI/export/path).
- Revoke active sessions/tokens where applicable.
3. Preserve evidence:
- Snapshot relevant DB rows, logs, audit chain state, and hashes.
4. Eradicate:
- Patch vulnerable path and validate with targeted tests.
5. Recover:
- Restore service with heightened monitoring.
6. Postmortem:
- Root cause, blast radius, remediation actions, and policy update.

## Evidence Checklist
- Incident timeline (UTC)
- Affected project/workspace IDs
- Actor/session IDs
- Audit chain verification result
- Containment actions and timestamps
- Legal/compliance notification record (if required)

## Definition of Done
- Every incident follows contain-preserve-eradicate-recover workflow.
- Evidence package is complete and stored immutably.

## Tests
- Quarterly tabletop run using a simulated cross-client leakage scenario.
- Verify incident evidence checklist completeness for each simulation.