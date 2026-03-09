# Sophon Data Intake Interaction Test Plan (UI Step-by-Step)

## Scope
Validate end-user interaction from Sophon Settings through Sources, Ingestion Jobs, Index, and Retrieval Lab.

## Preconditions
1. Open KORDA TOOLS desktop app (Tauri build).
2. Sophon module is visible in left navigation.
3. Runtime dependencies running for full ingestion path (Milvus/MinIO/Redis/NV-Ingest/RAG).

## Test A: API Key + Readiness
1. Go to `Sophon -> Settings`.
2. Enter NVIDIA API key (`nvapi-...`) and click `Save Key`.
3. Expected: `Stored key: Present`.
4. Click `Run Readiness Check`.
5. Expected: Readiness card populates with PASS/WARN/FAIL detail and remediation text.

## Test B: Add Source with PDFs in Folder Root
1. Go to `Sophon -> Sources`.
2. Set:
   - Source Type: `Folder (Recursive)`
   - Name: `UAT Root PDF`
   - Path: folder that has `file.pdf` directly in folder root.
   - Include Patterns: `*.pdf,*.docx,**/*.pdf,**/*.docx`
   - Allowed Extensions: `.pdf,.docx`
3. Click `Save Source`.
4. Expected: success message appears, source listed under `Configured Sources`.

## Test C: Validation Guardrails
1. In Add Source form, clear Name/Path and click `Save Source`.
2. Expected: inline error `Name and path are required...`.
3. Add a duplicate source (same name or path) and click `Save Source`.
4. Expected: inline error `A source with this name or path already exists.`.

## Test D: Queue + Monitor Job
1. In `Configured Sources`, click `Queue Ingestion`.
2. Go to `Sophon -> Ingestion Jobs`.
3. Verify action buttons by status:
   - `Pause` enabled only while running.
   - `Resume` enabled only while paused.
   - `Cancel` disabled for terminal statuses.
   - `Retry` enabled only for failed/cancelled jobs.
4. If failure occurs, verify failure reason includes include/ext settings context.

## Test E: Index + Retrieval
1. Go to `Sophon -> Index` and run `Validate` (and `Snapshot` if available).
2. Go to `Sophon -> Retrieval Lab`.
3. Enter query and click `Run Test`.
4. Expected: answer + retrieved passages with score.
5. Click `Export Report` and `Export Text`.
6. Expected: both files download.

## Test F: Restart Continuity
1. Close app fully.
2. Reopen app.
3. Verify:
   - Source list persists.
   - Stored key remains present.
   - Last readiness state can be refreshed successfully.
