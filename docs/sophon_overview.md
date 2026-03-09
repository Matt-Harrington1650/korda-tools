# Sophon Overview

## Purpose
Sophon is the embedded RAG operations module inside **KORDA TOOLS**.  
It is a first-class in-app capability for ingestion, index lifecycle, retrieval testing, policy enforcement, and backup/restore.

Sophon is not a separate browser admin and does not depend on a localhost HTTP UI.

## Host Integration (KORDA TOOLS)
- App shell and nav: `src/app/AppShell.tsx`
- Routing and Sophon IA: `src/app/router.tsx`
- Sophon runtime state + pipeline logic: `src/features/sophon/store/sophonStore.ts`
- Sophon contracts and schema: `src/features/sophon/types.ts`, `src/features/sophon/schemas.ts`
- Sophon pages: `src/pages/sophon/*`

## Data Ingestion Pipeline Model
Sophon models ingestion as strict stages:
1. `enumerate`
2. `classify`
3. `extract`
4. `normalize`
5. `chunk`
6. `embed`
7. `index`
8. `validate`
9. `publish`

Each job tracks:
- stage status and progress,
- deterministic checkpoints,
- validation results,
- retries and failure reason,
- dry-run and safe-mode options.

## Offline and Governance Controls
- Offline-only policy guard is enforced by `src/features/sophon/policy.ts`.
- Egress attempts are blocked and recorded in `blockedEgressAttempts`.
- Audit events are generated for runtime/source/job/index control actions.
- Local logs and metrics are retained in Sophon state for export.

## Runtime Design
- Runtime transport is in-process for Sophon control-plane behavior.
- No Sophon HTTP listener is created.
- Existing generic execution gateway remains separate and outside Sophon runtime scope.

## Current Scope
Implemented:
- Full Sophon IA in KORDA TOOLS.
- Source CRUD and ingestion queue controls.
- Stage-based ingestion progression with pause/resume/cancel/retry.
- Index rebuild/compact/validate/snapshot/restore/publish.
- Retrieval lab with citation-like passage traces and JSON/text report export.
- Backup/restore with dry-run validation and logs export.

Not yet implemented:
- Full NVIDIA model runtime parity via private IPC into KORDA-RAG internals.
- This remains a dedicated runtime adapter phase.
