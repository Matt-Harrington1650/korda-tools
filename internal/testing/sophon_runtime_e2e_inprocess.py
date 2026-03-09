from __future__ import annotations

import importlib.util
import json
import os
import shutil
import threading
import time
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "internal" / "testing" / "artifacts"
COMMAND_LOGS = ARTIFACTS / "command_logs"
PROFILE_DIR = ROOT / "internal" / "testing" / "runtime_profile"
SEED_FILE = ROOT / "internal" / "testing" / "sophon_rag_seed" / "sophon_test_knowledge.md"
OUT_JSON = ARTIFACTS / "sophon_e2e_raw.json"

QUERIES = [
    "What is the building service size and voltage for Orion Tower Renovation?",
    "What is ESB-1 rated for?",
    "Which ATS serves life safety loads?",
    "What is the generator runtime basis?",
    "What is the lobby decorative lighting load allowance?",
    "Did Revision A change the open office target?",
    "Which panel serves level 2 emergency lighting?",
    "Who manufactures the generator?",
    "What conduit size feeds MSB-1?",
    "Summarize what the generator serves and what it does not serve.",
    "Give me all short-circuit current values in this document.",
]


def run_with_timeout(fn: Callable[[], Any], timeout_sec: int) -> Any:
    holder: dict[str, Any] = {}

    def target() -> None:
        try:
            holder["result"] = fn()
        except Exception as exc:  # noqa: BLE001
            holder["error"] = str(exc)

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    thread.join(timeout=timeout_sec)
    if thread.is_alive():
        raise TimeoutError(f"Operation timed out after {timeout_sec}s")
    if "error" in holder:
        raise RuntimeError(holder["error"])
    return holder.get("result")


def configure_env() -> None:
    if PROFILE_DIR.exists():
        shutil.rmtree(PROFILE_DIR)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["SOPHON_APP_DATA_DIR"] = str(PROFILE_DIR)
    os.environ["SOPHON_KORDA_RAG_SRC"] = r"C:\code\KORDA-RAG\src"
    os.environ["SOPHON_BRIDGE_INIT_TIMEOUT_SEC"] = "180"
    os.environ["SOPHON_BRIDGE_CLIENT_INIT_TIMEOUT_SEC"] = "180"
    if not os.environ.get("NVIDIA_API_KEY") and os.environ.get("SOPHON_NVIDIA_API_KEY"):
        os.environ["NVIDIA_API_KEY"] = os.environ["SOPHON_NVIDIA_API_KEY"]


def load_runtime() -> Any:
    worker_path = ROOT / "src-tauri" / "scripts" / "sophon_runtime_worker.py"
    spec = importlib.util.spec_from_file_location("sophon_runtime_worker", worker_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Runtime()


def main() -> int:
    COMMAND_LOGS.mkdir(parents=True, exist_ok=True)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    output: dict[str, Any] = {
        "started_at": time.time(),
        "profile_dir": str(PROFILE_DIR),
        "seed_file": str(SEED_FILE),
        "steps": [],
        "truth_queries": [],
        "edge_cases": [],
    }

    def call(runtime: Any, method: str, params: dict[str, Any] | None = None, timeout: int = 300) -> Any:
        started = time.time()
        result = run_with_timeout(lambda: runtime.handle(method, params or {}), timeout)
        output["steps"].append(
            {
                "method": method,
                "params": params or {},
                "latency_sec": round(time.time() - started, 3),
                "result_type": type(result).__name__,
            }
        )
        return result

    try:
        configure_env()
        runtime = load_runtime()

        call(runtime, "ping", timeout=30)
        readiness = call(runtime, "check_readiness", timeout=240)
        checks = {c["id"]: c["status"] for c in readiness.get("checks", [])}
        output["readiness"] = readiness
        output["readiness_summary"] = {
            "state": readiness.get("state"),
            "bridge_init": checks.get("bridge_init"),
            "ingestor_dependencies": checks.get("ingestor_dependencies"),
            "rag_dependencies": checks.get("rag_dependencies"),
            "collection_bootstrap": checks.get("collection_bootstrap"),
            "source_setup": checks.get("source_setup"),
        }

        add_state = call(
            runtime,
            "add_source",
            {
                "name": "SOPHON_TEST_KNOWLEDGE",
                "sourceType": "file",
                "path": str(SEED_FILE),
                "includePatterns": ["**/*.md"],
                "excludePatterns": ["**/~$*"],
                "allowedExtensions": [".md"],
                "chunkSize": 800,
                "chunkOverlap": 120,
                "maxFileSizeMb": 100,
                "maxPages": 1000,
            },
            timeout=60,
        )
        source = next((s for s in add_state.get("sources", []) if s.get("name") == "SOPHON_TEST_KNOWLEDGE"), None)
        if source is None:
            raise RuntimeError("Failed to add SOPHON_TEST_KNOWLEDGE source.")

        queue_state = call(
            runtime,
            "queue_ingestion",
            {"sourceId": source["id"], "dryRun": False, "safeMode": False, "maxWorkers": 4},
            timeout=420,
        )
        job = queue_state.get("jobs", [])[0]
        output["initial_job_after_queue"] = job

        # Poll state for job terminal status.
        poll_start = time.time()
        terminal_job = None
        while time.time() - poll_start <= 600:
            state = call(runtime, "get_state", timeout=90)
            current = next((j for j in state.get("jobs", []) if j.get("id") == job.get("id")), None)
            if current and current.get("status") in {"completed", "failed", "cancelled"}:
                terminal_job = current
                break
            time.sleep(2)
        if terminal_job is None:
            raise TimeoutError("Initial ingestion job did not reach terminal status in 600s.")
        output["initial_job_terminal"] = terminal_job

        # Duplicate upload edge case.
        dup_state = call(
            runtime,
            "queue_ingestion",
            {"sourceId": source["id"], "dryRun": False, "safeMode": False, "maxWorkers": 4},
            timeout=420,
        )
        dup_job = dup_state.get("jobs", [])[0]
        output["duplicate_job_after_queue"] = dup_job
        output["edge_cases"].append({"id": "duplicate_upload", "job_status": dup_job.get("status"), "job_id": dup_job.get("id")})

        # Unsupported extension edge case.
        bad_source_state = call(
            runtime,
            "add_source",
            {
                "name": "SOPHON_BAD_EXT",
                "sourceType": "file",
                "path": str(SEED_FILE),
                "includePatterns": ["**/*.pdf"],
                "allowedExtensions": [".pdf"],
            },
            timeout=60,
        )
        bad_source = next((s for s in bad_source_state.get("sources", []) if s.get("name") == "SOPHON_BAD_EXT"), None)
        if bad_source is not None:
            bad_queue = call(runtime, "queue_ingestion", {"sourceId": bad_source["id"], "dryRun": False}, timeout=180)
            bad_job = bad_queue.get("jobs", [])[0]
            output["edge_cases"].append(
                {
                    "id": "unsupported_file_type",
                    "job_status": bad_job.get("status"),
                    "failure_reason": bad_job.get("failureReason"),
                    "job_id": bad_job.get("id"),
                }
            )

        # Truth-set queries.
        for query in QUERIES:
            state = call(runtime, "run_retrieval_test", {"query": query}, timeout=240)
            retrieval = state.get("lastRetrieval") or {}
            output["truth_queries"].append(
                {
                    "query": query,
                    "answer": retrieval.get("answer"),
                    "passage_count": len(retrieval.get("passages") or []),
                    "passages": retrieval.get("passages") or [],
                    "generatedAt": retrieval.get("generatedAt"),
                }
            )

        # Delete source and check query behavior.
        call(runtime, "remove_source", {"sourceId": source["id"]}, timeout=60)
        post_delete = call(runtime, "run_retrieval_test", {"query": "What is ESB-1 rated for?"}, timeout=120)
        output["post_delete_retrieval"] = post_delete.get("lastRetrieval")

        final_state = call(runtime, "get_state", timeout=120)
        output["final_state"] = final_state
        output["finished_at"] = time.time()
    except Exception as exc:  # noqa: BLE001
        output["error"] = str(exc)
        output["finished_at"] = time.time()

    OUT_JSON.write_text(json.dumps(output, indent=2, ensure_ascii=True), encoding="utf-8")
    if output.get("error"):
        print(f"ERROR: {output['error']}")
        print(f"raw output: {OUT_JSON}")
        return 1
    print(f"success: {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
