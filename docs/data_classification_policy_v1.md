# Data Classification Policy (v1)

## Classification Levels
- Public
- Internal
- Confidential
- Client-Confidential

## Policy Table
| Classification | Encryption At Rest | Encryption In Transit | External AI Permission | Export Rules | Retention Rules |
|---|---|---|---|---|---|
| Public | Y - Disk-level AES-256 baseline | Y - TLS 1.2+ | Default Allow; override not required | Any authenticated user in project may export PDF/CSV/JSON; no watermark required | Minimum 3 years; exceptions for marketing assets may be shorter with policy approval |
| Internal | Y - AES-256 for object storage + encrypted DB file | Y - TLS 1.2+ | Default Deny; Project Owner override with audit event | Export allowed to project members with `export_internal` role; formats PDF/CSV/JSON; watermark `INTERNAL` | Minimum 7 years; exception only by Governance approval |
| Confidential | Y - AES-256 + key rotation + secrets in vault only | Y - TLS 1.2+ with pinned endpoints where supported | Default Deny; dual override (Security Owner + Project Owner) with expiry | Export allowed only to assigned PM/Legal roles; formats PDF/A and controlled CSV; watermark `CONFIDENTIAL` with project id | Minimum 10 years; legal hold supersedes retention |
| Client-Confidential | Y - AES-256 + project-scoped keys + encrypted backups | Y - TLS 1.2+ and approved endpoint allowlist | Default Deny; dual override plus client approval reference required | Export only by Client Lead + Legal approver; formats PDF/A primary; watermark `CLIENT-CONFIDENTIAL` + recipient + timestamp | Minimum 15 years; exceptions prohibited unless contract amendment + legal sign-off |

## Examples
1. Public: marketing one-pager previously published on firm website.
2. Public: recruiting brochure and public capability statement.
3. Internal: staffing plan spreadsheet for upcoming quarter.
4. Internal: internal QA checklist template.
5. Confidential: draft cost model with vendor pricing.
6. Confidential: risk register with dispute exposure notes.
7. Client-Confidential: issued drawing package under client NDA.
8. Client-Confidential: sealed specification book with contractual obligations.
9. Client-Confidential: approved submittal log containing client proprietary details.
10. Confidential: legal correspondence summary tied to project claim analysis.

## Enforcement Points Inside KORDA
- Ingestion pipeline: classification required before artifact commit; reject missing classification.
- ObjectStoreService: enforces at-rest controls and blocks writes without project context.
- Service-layer authorization: enforces project boundary and classification-based access.
- AI Orchestrator PolicyEnforcer: blocks external AI for denied classes unless audited override exists.
- Export service: checks role + classification and applies required watermark/format policy.
- Retention engine: applies minimum retention and legal hold constraints before delete eligibility.
- Audit service: logs all classification changes, AI overrides, and exports with actor/time/project.

## Definition of Done
- All four classification levels are defined with enforceable controls.
- Policy table maps every required column (encryption, AI, export, retention).
- At least 8 concrete examples are documented.
- Enforcement points are mapped to concrete KORDA services.

## Tests
- Verify classification is mandatory at ingest and cannot be null.
- Verify external AI calls for Confidential/Client-Confidential fail without override.
- Verify export attempts enforce role, format, and watermark rules by class.
- Verify retention minimums and legal holds block premature deletion.
- Verify audit entries exist for classification change, export, and AI override events.