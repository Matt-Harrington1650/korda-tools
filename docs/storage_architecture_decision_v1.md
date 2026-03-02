# Storage Architecture Decision (v1)

## Section 1 - Assumptions (Explicit)

### Assumption 1: 50-200 staff
Concrete implications:
- Concurrent read/write pressure is steady and multi-team, so metadata locking and query isolation are mandatory.
- Role-based access control must support discipline separation (design, PM, CA, QA, legal).
- Onboarding/offboarding volume requires automated identity-to-project entitlement sync.

### Assumption 2: Multi-office
Concrete implications:
- Storage design must tolerate variable WAN latency and local office outages.
- Replication and caching are required, but authoritative writes still need deterministic conflict rules.
- Audit and policy enforcement must be location-agnostic and centrally verifiable.

### Assumption 3: Litigation exposure
Concrete implications:
- Immutable records, chain-auditable events, and timestamped provenance are baseline controls.
- Deletion must be policy-governed, legally holdable, and fully logged.
- Record-of-authority rules must separate authoritative project records from advisory analytics.

### Assumption 4: Mixed Revit/CAD/PDF (plus specs/RFIs/submittals/CA)
Concrete implications:
- Binary artifacts need object storage semantics; metadata must normalize cross-format lineage.
- Authoritative records need canonical formats (primarily PDF/A for issued sets) independent of source authoring tool.
- Ingestion must preserve original source plus derived representations without redefining source-of-truth.

### Assumption 5: Growth to 10M+ artifacts possible
Concrete implications:
- Object addressability by content hash is required for dedupe and scale.
- Metadata and governance queries require relational indexing and partition-friendly schema boundaries.
- AI retrieval stores must be treated as regenerable derivatives, not primary evidence.

### Non-goals
- Replacing core authoring tools (Revit/CAD) as design systems of creation.
- Making vector embeddings legally authoritative records.
- Building a cloud-coupled mandatory runtime in Phase 1.

### Constraints
- Windows-first desktop runtime (Tauri + React) with local SQLite baseline.
- Local-first operation with cloud-ready adapters only (no core cloud coupling).
- Strict project boundary isolation and evidentiary audit requirements.

### Risk posture
- Liability-minimizing and fail-closed by default.
- Evidence integrity prioritized over convenience.
- External AI use constrained by data classification and policy override workflow.

## Section 2 - Model Comparison Table (Scored 0-5)

| Model | Discoverability | Machine Readability | Immutability | Access Control | AEC Integration | Automation Feasibility | Overhead | Migration Risk | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A. Shared Drive | 1 | 1 | 1 | 2 | 3 | 1 | 4 | 4 | 17 |
| B. SharePoint / DMS | 3 | 2 | 2 | 4 | 3 | 2 | 2 | 3 | 21 |
| C. Object Store + Metadata DB | 4 | 4 | 5 | 4 | 4 | 4 | 3 | 3 | 31 |
| D. Hybrid: Object + Relational + Vector | 5 | 5 | 5 | 5 | 4 | 5 | 3 | 3 | 35 |
| E. Structured Drawing-as-Record DB | 2 | 5 | 3 | 4 | 1 | 3 | 1 | 1 | 20 |

### A. Shared Drive - Score Justification
#### Discoverability (1)
- Folder-path discovery is human-memory dependent and degrades at scale.

#### Machine Readability (1)
- File share layouts do not provide normalized metadata contracts.

#### Immutability (1)
- In-place overwrite is native behavior with weak tamper evidence.

#### Access Control (2)
- ACLs exist but are coarse and hard to maintain per project lifecycle.

#### AEC Integration (3)
- Existing teams can map current file habits, but governance depth is low.

#### Automation Feasibility (1)
- Reliable automation is limited by inconsistent naming and structure drift.

#### Overhead (4)
- Operational overhead appears low initially because teams already use it.

#### Migration Risk (4)
- Migration from current shared-drive habits is relatively low friction.

Key strengths:
- Low short-term change burden.
- Familiar workflows.

Key weaknesses:
- Weak governance and poor machine interoperability.
- High long-term discovery and audit costs.

Litigation posture:
- Weak; overwrite and sparse provenance create evidentiary risk.

AI posture:
- Poor; low metadata quality and no authoritative boundary controls.

### B. SharePoint / DMS - Score Justification
#### Discoverability (3)
- Search is better than file shares but quality depends on managed metadata discipline.

#### Machine Readability (2)
- API access exists, but metadata consistency and schema rigor are limited.

#### Immutability (2)
- Versioning helps but does not provide cryptographic chain guarantees by default.

#### Access Control (4)
- Mature RBAC and enterprise identity integration are available.

#### AEC Integration (3)
- Usable for document flows, but heavy CAD/BIM lifecycle fit is partial.

#### Automation Feasibility (2)
- Workflow automation exists but complex engineering controls are cumbersome.

#### Overhead (2)
- Administrative and licensing overhead is significant at scale.

#### Migration Risk (3)
- Migration is manageable but content model mismatch introduces cleanup burden.

Key strengths:
- Strong enterprise access controls.
- Better search than unmanaged shares.

Key weaknesses:
- Limited evidentiary immutability and weak AI-grade metadata discipline.

Litigation posture:
- Moderate; better than shares but still weak on cryptographic evidence.

AI posture:
- Moderate-low; retrieval quality depends on uneven metadata quality.

### C. Object Store + Metadata DB - Score Justification
#### Discoverability (4)
- Indexed metadata enables strong project-scoped search and faceting.

#### Machine Readability (4)
- Structured metadata supports deterministic automation and integration.

#### Immutability (5)
- Content-addressed object storage supports append-only evidence model.

#### Access Control (4)
- Service-layer policy enforcement can be fine-grained and project-scoped.

#### AEC Integration (4)
- Handles mixed large binaries and canonical issued outputs well.

#### Automation Feasibility (4)
- Clear interfaces and metadata contracts support reliable workflows.

#### Overhead (3)
- More engineering overhead than DMS, but manageable with adapters.

#### Migration Risk (3)
- Requires controlled metadata mapping and ingestion normalization.

Key strengths:
- Strong evidence integrity and scalable storage foundation.
- Good automation and governance fit.

Key weaknesses:
- Missing dedicated semantic retrieval tier unless extended.

Litigation posture:
- Strong; immutable artifacts and structured governance are defensible.

AI posture:
- Good baseline, but retrieval quality plateaus without vector layer.

### D. Hybrid: Object + Relational + Vector - Score Justification
#### Discoverability (5)
- Combines deterministic metadata search with semantic retrieval.

#### Machine Readability (5)
- Relational schema plus governed derived vectors maximize structured interoperability.

#### Immutability (5)
- Authoritative records remain in object + relational chain; vectors stay derivative.

#### Access Control (5)
- Service policy can jointly enforce project scope across artifacts, metadata, and retrieval.

#### AEC Integration (4)
- Supports mixed BIM/CAD/PDF ecosystems while preserving issued-record controls.

#### Automation Feasibility (5)
- Explicit adapters and layered stores support robust orchestration and compliance checks.

#### Overhead (3)
- Operational complexity is higher, but justified by governance and scale benefits.

#### Migration Risk (3)
- Moderate migration complexity, controlled by phased ingestion and adapter strategy.

Key strengths:
- Best balance of evidence integrity, scale, and AI retrieval capability.
- Clear authority boundary: vectors are regenerable derivatives.

Key weaknesses:
- Requires disciplined architecture governance and runbook maturity.

Litigation posture:
- Strongest option with explicit authority separation and chain-auditable controls.

AI posture:
- Strongest option for safe AI enablement without allowing AI to become record.

### E. Structured Drawing-as-Record DB - Score Justification
#### Discoverability (2)
- Queryable structure exists, but only for narrowly modeled artifacts.

#### Machine Readability (5)
- Highly structured schema enables deep machine processing for supported types.

#### Immutability (3)
- Can be enforced, but complex transformations increase integrity risk.

#### Access Control (4)
- Strong central control is possible through strict schema-driven services.

#### AEC Integration (1)
- Poor fit for mixed and evolving real-world deliverable formats.

#### Automation Feasibility (3)
- Powerful for constrained domains, brittle for heterogeneous project content.

#### Overhead (1)
- Very high modeling and maintenance overhead.

#### Migration Risk (1)
- Highest migration risk due to forced normalization and data loss risk.

Key strengths:
- Strong machine modeling for narrow, structured use cases.

Key weaknesses:
- Weak practical fit for full AEC record ecosystem.

Litigation posture:
- Mixed; structure helps, but transformation burden can undermine evidentiary trust.

AI posture:
- Narrowly strong; broad project knowledge coverage is weak.

## Section 3 - Decision
Chosen architecture:
- **D) Hybrid: Object Storage + Relational DB + Vector DB**

Structural reasons:
- Object storage = immutability + scale.
- Relational DB = governance + metadata integrity.
- Vector DB = AI retrieval.
- Adapter layer = cloud-ready without coupling.

Explicit rejection reasons:
- A rejected: inadequate immutability, auditability, and machine discoverability.
- B rejected: access control is strong but evidentiary immutability and AI-quality metadata are insufficient.
- C rejected: strong baseline but lacks first-class semantic retrieval needed for long-horizon AI workflows.
- E rejected: impractical migration and operational burden for heterogeneous AEC records.

## Section 4 - Implementation Implications (Immediate)
- Implement `ObjectStore` adapter interface as the only artifact blob write/read entry path.
- Implement relational metadata schema with strict project/workspace keys, FK constraints, and indexed lineage.
- Treat vector index as derivative and regenerable; never use vectors as authoritative source.
- Enforce audit chain + immutability on all state-changing operations.
- Enforce project boundary scoping at service layer for all queries and writes.
- Bind external AI permissions to classification policy with default deny and audited overrides.

## Definition of Done
- All matrix cells are scored 0-5 and every score is justified.
- Hybrid architecture is explicitly selected with structural reasons and rejection reasons for A, B, C, E.
- Immediate implementation implications are actionable and map to KORDA layers.

## Tests
- Run: `rg -n "Model Comparison Table|Hybrid: Object|Public|Client-Confidential|Record of Authority" docs internal`
- Verify every model section contains all 8 score dimensions plus strengths/weaknesses/litigation posture/AI posture.
- Verify decision section explicitly states model D as chosen.