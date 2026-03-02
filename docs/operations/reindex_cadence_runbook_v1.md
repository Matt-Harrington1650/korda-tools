# Re-index Cadence Runbook (v1)

## Cadence
- Hot: incremental on every authoritative change.
- Warm: weekly sweep.
- Cold: monthly batch.
- Archive: annual eligibility check.

## Re-index Pipeline
1. Build candidate corpus from authoritative artifacts.
2. Validate classification gates and exclusions.
3. Generate embeddings/index entries (derivative only).
4. Run citation/coverage QA sample.
5. Publish index manifest and retain prior snapshot for rollback.

## Rollback
- Restore previous index snapshot if QA fails or conflict rates spike.
- Keep authoritative object/metadata layers unchanged.

## Definition of Done
- Re-index cadence is automated and auditable per tier.
- Rollback to prior snapshot is tested.

## Tests
- Simulate stale index lag and perform forced re-index + rollback.
- Validate manifest diff and citation parity post-run.