# Sophon Definition of Done

## Product Integration
- [x] Sophon is visible as a top-level module in KORDA TOOLS navigation.
- [x] Sophon IA sections exist in-product:
  - [x] Dashboard
  - [x] Sources
  - [x] Ingestion Jobs
  - [x] Index
  - [x] Retrieval Lab
  - [x] Models & Tuning
  - [x] Policies & Audit
  - [x] Backup/Restore
  - [x] Settings
- [x] No separate browser admin is required for Sophon operation.

## Offline + Security
- [x] Offline-only policy guard exists.
- [x] Outbound egress block evidence is captured in Sophon state.
- [x] Runtime control path does not rely on localhost UI endpoints.

## Operations
- [x] Source create/remove flow works.
- [x] Ingestion queue and stage progression work.
- [x] Pause/resume/cancel/retry controls exist.
- [x] Index rebuild/compact/validate/snapshot/restore/publish controls exist.
- [x] Retrieval test supports JSON and text export.
- [x] Backup export/import supports dry-run validation.
- [x] Logs bundle export exists.

## Governance
- [x] Configuration and operator actions are auditable in Sophon state.
- [x] Audit events are visible and filterable in UI.
- [x] RBAC role selection (admin/operator/viewer) is managed in-product.

## Quality Gates
- [x] Unit tests cover policy enforcement.
- [x] Store tests cover staged ingestion/index lifecycle.
- [x] UI smoke tests cover Sophon route rendering.
- [ ] Full private-IPC NVIDIA runtime adapter parity with KORDA-RAG internals.

## Next-Use Verification
- [x] Consolidated Two-Tier verification plan exists (`sophon_next_use_verification_plan.md`).
- [x] Tier 1 preflight runbook exists (`sophon_next_use_tier1_runbook.md`).
- [x] Tier 2 deep verification runbook exists (`sophon_next_use_tier2_runbook.md`).
- [x] Automated verifier script exists (`scripts/sophon-verify-next-use.ps1`).
- [x] Machine-readable verifier summary artifact path is defined.
