# Phased Storage Evolution Plan (v1)

## Objective
Execute a reversible migration path from shared-drive operations to an AI-enabled, governance-safe platform without disrupting project delivery.

## Phase 1: Shared Drive + Naming Enforcement

### Tooling options
- Low cost:
- Windows file shares + scripted filename linter (`rg` + PowerShell checks) + manual review queue.
- Medium cost:
- Shared drive + automated watcher service enforcing naming/taxonomy policies + violation dashboard.
- High cost:
- Managed DMS front-end enforcing naming templates at upload, integrated with identity provider.

### Operational overhead (hours/week by role)
| Role | Hours/Week |
|---|---:|
| IT | 6 |
| PM | 3 |
| Engineer | 2 |
| Admin | 5 |

### Adoption risks
- Teams bypass naming rules under deadline pressure.
- Inconsistent discipline codes create search fragmentation.
- Manual correction queues backlog.

### Success metrics
- >= 90% of new files pass naming validation on first attempt.
- Top-level taxonomy compliance >= 95%.
- Upload-to-availability latency <= 15 minutes.

### Triggers to proceed
- 4 consecutive weeks above naming/taxonomy thresholds.
- Violation backlog < 2 business days.
- No critical project blocked by naming enforcement.

### Rollback strategy
- Disable hard-block mode and revert to warning-only enforcement.
- Preserve violation logs for remediation planning.
- Keep canonical naming policy unchanged; only relax enforcement mechanism temporarily.

## Phase 2: Metadata Capture + Ingestion Engine

### Tooling options
- Low cost:
- Batch metadata CSV intake + nightly ingestion jobs + SQLite metadata tables.
- Medium cost:
- Event-driven ingestion service with extraction pipeline and confidence routing.
- High cost:
- Managed ingestion/orchestration platform with OCR acceleration and policy hooks.

### Operational overhead (hours/week by role)
| Role | Hours/Week |
|---|---:|
| IT | 10 |
| PM | 4 |
| Engineer | 4 |
| Admin | 8 |

### Adoption risks
- Metadata completeness gaps reduce discoverability.
- Extraction confidence variability drives manual review load.
- Incorrect sensitivity labeling creates compliance risk.

### Success metrics
- Required metadata completeness >= 98% on new ingests.
- Extraction confidence median >= 0.85 for core fields.
- Ingestion failure rate <= 2% with retry resolution <= 24h.

### Triggers to proceed
- Metadata completeness and failure targets met for 6 weeks.
- Audit log captures 100% of ingestion actions.
- Classification policy violations trend downward week-over-week.

### Rollback strategy
- Freeze ingestion writes; continue read-only metadata access.
- Revert to Phase 1 naming-only operations while fixing extractors.
- Reprocess queued artifacts from checkpointed manifests.

## Phase 3: Experience DB + Structured Precedent

### Tooling options
- Low cost:
- SQLite precedent tables + curated manual linking of outcomes.
- Medium cost:
- Relational precedent service with sheet/RFI/submittal link extraction and reviewer workflow.
- High cost:
- Hybrid relational + vector derivative index with feedback scoring and search analytics.

### Operational overhead (hours/week by role)
| Role | Hours/Week |
|---|---:|
| IT | 12 |
| PM | 5 |
| Engineer | 6 |
| Admin | 7 |

### Adoption risks
- Low trust if precedents are stale or weakly cited.
- Over-reliance on derived links without human validation.
- Reviewer fatigue for conflict/outdated flags.

### Success metrics
- Citation coverage >= 95% for precedent-assisted responses.
- Superseded-document citation rate <= 1%.
- Reviewer acceptance rate >= 85% on high-confidence suggestions.

### Triggers to proceed
- 3 pilot projects complete with precedent metrics above targets.
- Conflict detection false-positive rate <= 10%.
- Governance sign-off that authority boundaries are enforced.

### Rollback strategy
- Disable automated precedent suggestions; keep manual lookup only.
- Preserve structured links and feedback data for retraining.
- Revert user-facing assistant to citation-only retrieval mode.

## Phase 4: Predictive Modeling + SME Feedback Loops

### Tooling options
- Low cost:
- Rule-based risk scoring with manual SME feedback capture.
- Medium cost:
- Supervised predictive models on validated historical signals with monthly retraining.
- High cost:
- Multi-model ensemble with active learning, bias monitoring, and automated champion/challenger evaluation.

### Operational overhead (hours/week by role)
| Role | Hours/Week |
|---|---:|
| IT | 14 |
| PM | 6 |
| Engineer | 7 |
| Admin | 6 |

### Adoption risks
- Alert fatigue from noisy predictions.
- Model drift causing degraded precision/recall.
- Legal exposure if predictions are interpreted as authoritative directives.

### Success metrics
- Precision >= 0.80 and recall >= 0.70 on agreed risk classes.
- SME feedback closure within 5 business days.
- Material-risk miss rate declines quarter-over-quarter.

### Triggers to proceed
- Two consecutive model evaluation cycles meet precision/recall targets.
- SME participation >= 80% for designated reviewers.
- No unresolved high-severity governance exceptions.

### Rollback strategy
- Switch predictive outputs to advisory-only with mandatory human review.
- Revert to Phase 3 precedent guidance while retraining/remediating model.
- Archive model artifacts and decision logs for audit traceability.

## Cutover Triggers From Legacy Drive
- Legacy drive write activity <= 10% of total weekly artifact writes for 8 consecutive weeks.
- 100% of active projects mapped to taxonomy + naming policy.
- Metadata completeness >= 98% and ingestion SLA met for all active projects.
- Governance controls (audit chain, classification enforcement, export controls) pass formal review.

## Parallel-Run Strategy
- Dual-write window: new artifacts written to governed path while legacy copy retained for safety.
- Read preference shifts in stages:
1. Phase A: legacy-first read, governed-path fallback.
2. Phase B: governed-path first, legacy fallback for misses.
3. Phase C: governed-path only, legacy set to read-only.
- Weekly reconciliation compares artifact counts, hashes, and metadata parity across both paths.
- Parallel-run exit requires zero critical reconciliation mismatches for 4 consecutive weeks.

## Data Validation Steps
1. Filename/taxonomy conformance validation at ingest.
2. Metadata schema validation (`project_id`, `artifact_type`, `discipline`, `status`, `sensitivity_level`).
3. Hash integrity check (`sha256`) between object and metadata record.
4. Referential integrity checks for sheet/RFI/submittal links.
5. Citation validity checks (non-superseded authoritative sources by default).
6. Retention/classification policy checks before export/delete operations.
7. Audit-chain verification after each migration batch.

## Definition of Done
- All four phases include tooling options (low/medium/high), role-based hours/week, adoption risks, success metrics, proceed triggers, and rollback strategy.
- Cutover triggers, parallel-run strategy, and data validation steps are explicitly defined.
- Plan is executable in sequence and reversible at each phase gate.

## Tests
- `rg -n "Rollback|Triggers|hours/week|Parallel-run" docs/phased_storage_evolution_plan_v1.md`
- Manual: run a mock phase-gate review and verify each proceed trigger has measurable evidence.
- Manual: execute a rollback drill in staging for one phase and validate data/audit continuity.
- Manual: run weekly reconciliation script on dual-write sample and confirm hash + metadata parity.