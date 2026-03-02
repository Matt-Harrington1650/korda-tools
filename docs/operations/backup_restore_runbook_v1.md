# Backup and Restore Runbook (v1)

## Backup Policy
- Daily encrypted backups for active DB/object metadata.
- Weekly immutable snapshot for warm/cold tiers.
- Monthly archive snapshot with WORM retention policy.

## Restore Procedure
1. Select restore point and verify backup manifest checksum.
2. Restore metadata DB and object set into isolated validation environment.
3. Run integrity checks:
- artifact hash validation
- audit-chain verification
- row-count parity checks
4. Promote restore only after validation pass and approval.

## RTO/RPO Targets
- Active projects: RTO <= 4h, RPO <= 24h.
- Warm/cold projects: RTO <= 24h, RPO <= 7d.

## Definition of Done
- Restore procedure is executable in staging and production emergency contexts.
- Integrity validation is mandatory before restore promotion.

## Tests
- Monthly restore drill on sampled project set.
- Verify checksum parity and audit-chain continuity in drill report.