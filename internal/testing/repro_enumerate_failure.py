import importlib.util
import json
import os
from pathlib import Path

os.environ["SOPHON_APP_DATA_DIR"] = r"C:\code\ai-tool-hub\internal\testing\tmp_runtime_state_pre_fix"

worker_path = Path(r"C:\code\ai-tool-hub\src-tauri\scripts\sophon_runtime_worker.py")
spec = importlib.util.spec_from_file_location("sophon_runtime_worker", worker_path)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)
rt = mod.Runtime()

fixture_file = r"C:\code\ai-tool-hub\internal\testing\ingestion_repro_fixture\sample.md"
fixture_dwg_only = r"C:\code\ai-tool-hub\internal\testing\ingestion_repro_fixture_dwg_only"

state = rt.handle("add_source", {
  "name": "CASE_A_FILE_AS_FOLDER",
  "sourceType": "folder",
  "path": fixture_file,
  "includePatterns": ["*.pdf", "*.docx", "*.md", "**/*.pdf", "**/*.docx", "**/*.md"],
  "allowedExtensions": [".pdf", ".docx", ".dwg", ".dxf", ".ifc", ".xlsx", ".csv", ".txt", ".jpg", ".png", ".md"],
})
sid_a = state["sources"][0]["id"]
state = rt.handle("queue_ingestion", {"sourceId": sid_a, "dryRun": False, "safeMode": True})
job_a = state["jobs"][0]

state = rt.handle("add_source", {
  "name": "CASE_B_DWG_ONLY",
  "sourceType": "folder",
  "path": fixture_dwg_only,
  "includePatterns": ["*.pdf", "*.docx", "*.md", "**/*.pdf", "**/*.docx", "**/*.md"],
  "allowedExtensions": [".pdf", ".docx", ".dwg", ".dxf", ".ifc", ".xlsx", ".csv", ".txt", ".jpg", ".png", ".md"],
})
sid_b = state["sources"][0]["id"]
state = rt.handle("queue_ingestion", {"sourceId": sid_b, "dryRun": False, "safeMode": True})
job_b = state["jobs"][0]

print(json.dumps({
  "case_a": {
    "status": job_a.get("status"),
    "failureReason": job_a.get("failureReason"),
    "discoveredFiles": job_a.get("discoveredFiles")
  },
  "case_b": {
    "status": job_b.get("status"),
    "failureReason": job_b.get("failureReason"),
    "discoveredFiles": job_b.get("discoveredFiles")
  }
}, indent=2))
