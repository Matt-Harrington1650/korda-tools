# KPI Dashboard Specification (v1)

## Core KPI Domains
- Ingestion reliability
- Governance/policy enforcement
- Audit integrity
- AI response quality
- Data freshness and retrieval quality

## KPI Definitions
| KPI | Definition | Target | Alert Threshold | Owner |
|---|---|---:|---:|---|
| Ingestion Coverage % | Ingested required artifacts / expected artifacts | >= 98% | < 95% | Data Operations |
| Metadata Completeness % | Records with all required metadata fields | >= 98% | < 96% | Data Platform |
| Policy Violation Rate | Violations per 1,000 operations | <= 2 | > 5 | Security |
| Audit Chain Integrity Pass % | Successful chain verifications | 100% | < 100% | Platform Engineering |
| Superseded Citation Rate | Answers citing superseded artifacts | <= 1% | > 2% | AI Platform |
| Low-Confidence Response Rate | Responses with confidence < 0.70 | <= 15% | > 25% | AI Platform |
| Stale Index Lag (hours) | Age difference between artifact updates and index | <= 24h | > 72h | Search Platform |
| Export Abuse Alerts | Confirmed abnormal export incidents | 0 | >= 1 | Security Operations |

## Dashboard Requirements
- Daily KPI rollup with project-level drilldown.
- Weekly trendline with anomaly markers.
- Exportable compliance report (CSV/PDF) for governance review.

## Definition of Done
- KPI formulas, targets, and owners are documented.
- Alert thresholds are explicit and actionable.

## Tests
- Validate each KPI can be computed from current telemetry fields.
- Simulate threshold breach and verify alert routing.