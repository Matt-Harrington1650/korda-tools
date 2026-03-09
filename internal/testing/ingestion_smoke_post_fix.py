import importlib.util
import json
import os
from pathlib import Path

os.environ["SOPHON_APP_DATA_DIR"] = r"C:\code\ai-tool-hub\internal\testing\tmp_runtime_state_smoke"

worker_path = Path(r"C:\code\ai-tool-hub\src-tauri\scripts\sophon_runtime_worker.py")
spec = importlib.util.spec_from_file_location("sophon_runtime_worker", worker_path)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)
rt = mod.Runtime()

fixture_dir = r"C:\code\ai-tool-hub\internal\testing\ingestion_repro_fixture"

state = rt.handle("add_source", {
  "name": "SMOKE_ENUMERATE_POST_FIX",
  "sourceType": "folder",
  "path": fixture_dir,
  "includePatterns": ["*.pdf", "*.docx", "*.md", "**/*.pdf", "**/*.docx", "**/*.md"],
  "allowedExtensions": [".pdf", ".docx", ".dwg", ".dxf", ".ifc", ".xlsx", ".csv", ".txt", ".jpg", ".png", ".md"],
})
source_id = state["sources"][0]["id"]
state = rt.handle("queue_ingestion", {"sourceId": source_id, "dryRun": False, "safeMode": True})
job = state["jobs"][0]

print(json.dumps({
  "jobId": job.get("id"),
  "status": job.get("status"),
  "currentStage": job.get("currentStage"),
  "discoveredFiles": job.get("discoveredFiles"),
  "failureReason": job.get("failureReason"),
  "enumerateDiagnostics": job.get("enumerateDiagnostics"),
}, indent=2))
