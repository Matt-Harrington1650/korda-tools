# Institutional Memory 50-Year Plan (v1)

## 1) Storage Tiers

### Tier: Hot (active project)
Purpose:
- Primary working set for active delivery, coordination, and rapid decision support.

Typical retrieval expectations:
- Interactive retrieval, target <= 3 seconds for metadata and <= 10 seconds for large artifact fetch.

Storage medium assumptions (local vs cloud-ready):
- Local-first authoritative store on desktop/office-managed storage.
- Cloud-ready adapter may replicate for resilience and distributed access, but does not supersede local authority.

Integrity verification cadence:
- Write-time hash verification on every ingest.
- Daily rolling spot-check (minimum 1% of active artifacts).

### Tier: Warm (closed < 5 years)
Purpose:
- Frequent post-close reference, warranty support, dispute response, and lessons-learned retrieval.

Typical retrieval expectations:
- Near-interactive retrieval, target <= 30 seconds for most artifacts.

Storage medium assumptions (local vs cloud-ready):
- Local archive cache plus cloud-ready replicated object storage for durability.
- Relational metadata remains queryable with full project boundary controls.

Integrity verification cadence:
- Weekly hash-chain and object checksum verification.
- Monthly full metadata consistency checks.

### Tier: Cold (5-20 years)
Purpose:
- Long-tail legal, compliance, and precedent retrieval with lower access frequency.

Typical retrieval expectations:
- Deferred retrieval acceptable, target <= 4 hours depending on medium.

Storage medium assumptions (local vs cloud-ready):
- Cost-optimized object storage tier, optionally offline/nearline copies.
- Metadata index kept online for discovery; payload retrieval may be delayed.

Integrity verification cadence:
- Quarterly full re-hash verification by project segment.
- Semi-annual audit chain verification and manifest reconciliation.

### Tier: Archive (>20 years, WORM)
Purpose:
- Permanent evidentiary preservation and institutional memory continuity.

Typical retrieval expectations:
- Non-interactive retrieval acceptable, target same day to 72 hours.

Storage medium assumptions (local vs cloud-ready):
- WORM-capable storage required (immutable retention lock).
- Redundant media strategy across at least two independent storage domains.

Integrity verification cadence:
- Annual full re-hash validation.
- Annual restore drill and format readability verification.

## 2) Non-Negotiables
- Raw preserved in original format for every artifact class.
- PDF/A normalization policy by artifact type:
- Issued Drawings -> PDF/A required.
- Specs -> PDF/A required.
- RFIs/Submittals/CA logs -> PDF/A preferred, source retained.
- Calculations -> PDF source retained; optional PDF/A companion export.
- Embeddings are regenerable derivatives and never treated as records.
- Periodic re-hash validation plan is mandatory across all tiers.
- Vendor lock mitigation requires open/exportable formats for metadata and manifests (CSV/JSON/SQL dump + checksum manifests).

## 3) Re-Indexing Cadence and Validation Checkpoints
Re-indexing cadence:
- Hot: incremental re-index on every authoritative artifact state change.
- Warm: weekly re-index sweep for changed or newly linked records.
- Cold: monthly re-index batch.
- Archive: annual re-index eligibility check; re-index only when parser/model upgrades materially improve retrieval quality.

Validation checkpoints:
1. Pre-index checkpoint: verify artifact hash integrity and classification policy status.
2. In-index checkpoint: track parser version, model version, and extraction confidence metrics.
3. Post-index checkpoint: sample 5-10% of outputs for citation correctness and project-boundary integrity.
4. Promotion checkpoint: publish index manifest with timestamp, corpus coverage, and stale-source ratio.
5. Rollback checkpoint: retain previous index snapshot until validation passes.

## 4) Data Decay Monitoring Signals + Remediation
Signals:
- Rising unreadable-file rate by format/version.
- Hash mismatch incidents over baseline threshold.
- Declining extraction confidence by artifact type.
- Citation coverage degradation over time.
- Restore drill failures or prolonged recovery times.
- Increasing stale index lag relative to authoritative updates.

Remediation:
- Format obsolescence remediation: normalize to preservation format while retaining original raw artifact.
- Integrity remediation: quarantine mismatched objects, restore from validated replica, and append incident audit trail.
- Extraction remediation: retrain/update parsers, re-run extraction and compare confidence uplift.
- Index remediation: force re-index with deterministic manifest diff and reviewer sign-off.
- Disaster readiness remediation: run quarterly restore drills until SLA conformance is recovered.

## Definition of Done
- All four storage tiers are defined with purpose, retrieval expectations, storage assumptions, and integrity cadence.
- Non-negotiables explicitly include raw preservation, PDF/A policy, embeddings as derivative, re-hash plan, and lock-mitigation.
- Re-indexing cadence includes concrete checkpoints and rollback gate.
- Data decay signals and remediation actions are explicit and operationally testable.

## Tests
- `rg -n "PDF/A|WORM|re-hash|embeddings" docs/institutional_memory_50yr_plan_v1.md`
- Manual: execute one integrity verification run per tier and archive evidence.
- Manual: perform one restore drill from Archive tier and verify hash/citation continuity.
- Manual: simulate stale index lag and confirm remediation runbook steps are followed and audited.