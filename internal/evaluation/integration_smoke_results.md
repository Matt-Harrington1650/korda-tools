# Integration Smoke Results

## Definition of Done
- Demonstrate whether KORDA-RAG can run an in-process smoke cycle without opening HTTP listeners.
- Capture before/after listener state and RAG/Ingestor call results.

## Tests (commands run + results)
1. Ensured telemetry dependency in canonical Sophon venv:
   - `C:\code\ai-tool-hub\.sophon-py\Scripts\python.exe -m pip install opentelemetry-processor-baggage`
2. Ran smoke script:
   - `C:\code\ai-tool-hub\.sophon-py\Scripts\python.exe C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py`

Result payload:
- `before_port_count`: 38
- `after_port_count`: 38
- `new_listening_ports`: `[]`
- `search_status`: `ok`
- `ingest_status`: `ok`
- `ingest_response.state`: `FAILED` (expected for empty file list smoke input)

## Findings (severity-ranked: P0/P1/P2/P3)
- P1: In-process no-bind execution path is valid for smoke-level RAG + ingestion calls.
- P0: This smoke does not prove full no-service production operation; it proves callable library surface only.

## Evidence (file paths + line ranges + short snippets + command output summary)
- Smoke harness source:
  - `C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py:16-18` (imports from `nvidia_rag`).
  - `C:\code\ai-tool-hub\internal\evaluation\integration_smoke.py:140-193` (smoke flow and returned payload).
- Dependency remediation:
  - `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase4_sophonpy_opentelemetry_install.log:1-24`.
- Runtime output:
  - `C:\code\ai-tool-hub\internal\evaluation\artifacts\command_logs\phase4_integration_smoke.log:970-984`.

## Changes Applied
- Added smoke harness script and executed it.
- Installed missing telemetry processor package in canonical Sophon runtime venv.

## Re-test Results
- Smoke run completed and returned structured JSON output.
- No new listening TCP ports observed during run.

## Remaining Blockers
- Full end-to-end production no-service ingest/query path still requires architecture work (offline profile + dependency boundary hardening).
