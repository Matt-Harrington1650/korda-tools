from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
WORKER = ROOT / "src-tauri" / "scripts" / "sophon_runtime_worker.py"
PROFILE_DIR = ROOT / "internal" / "testing" / "runtime_profile"
SEED_DIR = ROOT / "internal" / "testing" / "sophon_rag_seed"
ARTIFACTS_DIR = ROOT / "internal" / "testing" / "artifacts"
COMMAND_LOGS_DIR = ARTIFACTS_DIR / "command_logs"
OUT_JSON = ARTIFACTS_DIR / "sophon_e2e_raw.json"
ERR_LOG = COMMAND_LOGS_DIR / "sophon_runtime_worker_stderr.log"

TRUTH_QUERIES = [
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


@dataclass
class WorkerClient:
    proc: subprocess.Popen[str]
    req_id: int = 0

    def call(self, method: str, params: dict[str, Any] | None = None) -> Any:
        self.req_id += 1
        payload = {"id": f"req-{self.req_id}", "method": method, "params": params or {}}
        line = json.dumps(payload, ensure_ascii=True)
        assert self.proc.stdin is not None
        assert self.proc.stdout is not None
        self.proc.stdin.write(line + "\n")
        self.proc.stdin.flush()

        started = time.time()
        while True:
            response_line = self.proc.stdout.readline()
            if response_line == "":
                raise RuntimeError(f"Worker exited while waiting for response to {method}.")
            response_line = response_line.strip()
            if not response_line:
                if time.time() - started > 180:
                    raise TimeoutError(f"Timed out waiting for response line for {method}.")
                continue
            response = json.loads(response_line)
            if response.get("id") != payload["id"]:
                continue
            if "error" in response:
                raise RuntimeError(f"{method} failed: {response['error']}")
            return response.get("result")

    def close(self) -> None:
        try:
            self.call("shutdown")
        except Exception:
            pass
        finally:
            try:
                self.proc.terminate()
            except Exception:
                pass
            try:
                self.proc.wait(timeout=10)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass


def resolve_python() -> str:
    venv = ROOT / ".sophon-py" / "Scripts" / "python.exe"
    if venv.exists():
        return str(venv)
    return sys.executable


def profile_reset() -> None:
    if PROFILE_DIR.exists():
        shutil.rmtree(PROFILE_DIR)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)


def build_env() -> dict[str, str]:
    env = os.environ.copy()
    env["SOPHON_APP_DATA_DIR"] = str(PROFILE_DIR)
    env["SOPHON_KORDA_RAG_SRC"] = r"C:\code\KORDA-RAG\src"
    env["SOPHON_BRIDGE_INIT_TIMEOUT_SEC"] = "45"
    env["SOPHON_BRIDGE_CLIENT_INIT_TIMEOUT_SEC"] = "90"
    if not env.get("NVIDIA_API_KEY"):
        sop_key = env.get("SOPHON_NVIDIA_API_KEY")
        if sop_key:
            env["NVIDIA_API_KEY"] = sop_key
    return env


def wait_for_terminal_job(client: WorkerClient, job_id: str, timeout_sec: int = 420) -> dict[str, Any]:
    start = time.time()
    last_state: dict[str, Any] = {}
    while time.time() - start <= timeout_sec:
        state = client.call("get_state")
        last_state = state
        for job in state.get("jobs", []):
            if job.get("id") == job_id:
                if job.get("status") in {"completed", "failed", "cancelled"}:
                    return job
        time.sleep(2)
    raise TimeoutError(f"Job {job_id} did not reach terminal state within {timeout_sec}s.")


def main() -> int:
    COMMAND_LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    profile_reset()

    python_bin = resolve_python()
    env = build_env()
    worker_cmd = [python_bin, str(WORKER)]
    proc = subprocess.Popen(
        worker_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    client = WorkerClient(proc=proc)
    result: dict[str, Any] = {
        "worker_cmd": worker_cmd,
        "profile_dir": str(PROFILE_DIR),
        "seed_file": str(SEED_DIR / "sophon_test_knowledge.md"),
        "timestamps": {"started_at_unix": time.time()},
        "calls": [],
        "truth_queries": [],
        "edge_tests": [],
    }

    def capture_call(method: str, params: dict[str, Any] | None = None) -> Any:
        started = time.time()
        payload = params or {}
        out = client.call(method, payload)
        result["calls"].append(
            {
                "method": method,
                "params": payload,
                "latency_sec": round(time.time() - started, 3),
                "result_type": type(out).__name__,
            }
        )
        return out

    try:
        ping = capture_call("ping")
        readiness = capture_call("check_readiness")

        seed_file = SEED_DIR / "sophon_test_knowledge.md"
        add_state = capture_call(
            "add_source",
            {
                "name": "SOPHON_TEST_KNOWLEDGE",
                "sourceType": "file",
                "path": str(seed_file),
                "includePatterns": ["**/*.md"],
                "excludePatterns": ["**/~$*"],
                "allowedExtensions": [".md"],
                "chunkSize": 800,
                "chunkOverlap": 120,
                "maxFileSizeMb": 100,
                "maxPages": 1000,
            },
        )
        source = next((x for x in add_state.get("sources", []) if x.get("name") == "SOPHON_TEST_KNOWLEDGE"), None)
        if not source:
            raise RuntimeError("Added source was not present in returned state.")

        queue_state = capture_call(
            "queue_ingestion",
            {"sourceId": source["id"], "dryRun": False, "safeMode": False, "maxWorkers": 4},
        )
        queued_job = queue_state.get("jobs", [])[0]
        job_id = queued_job.get("id")
        if not job_id:
            raise RuntimeError("Queue ingestion did not return a job id.")

        terminal_job = wait_for_terminal_job(client, job_id)
        latest_state = capture_call("get_state")

        # Duplicate upload behavior.
        dup_queue_state = capture_call(
            "queue_ingestion",
            {"sourceId": source["id"], "dryRun": False, "safeMode": False, "maxWorkers": 4},
        )
        dup_job_id = dup_queue_state.get("jobs", [])[0].get("id")
        duplicate_terminal = wait_for_terminal_job(client, dup_job_id) if dup_job_id else {}

        # Unsupported extension behavior (should fail with no files matched).
        bad_source_state = capture_call(
            "add_source",
            {
                "name": "SOPHON_BAD_EXT",
                "sourceType": "file",
                "path": str(seed_file),
                "includePatterns": ["**/*.pdf"],
                "allowedExtensions": [".pdf"],
            },
        )
        bad_source = next((x for x in bad_source_state.get("sources", []) if x.get("name") == "SOPHON_BAD_EXT"), None)
        bad_queue_state = capture_call("queue_ingestion", {"sourceId": bad_source["id"], "dryRun": False}) if bad_source else {}
        bad_jobs = bad_queue_state.get("jobs") or []
        bad_job = bad_jobs[0] if bad_jobs else {}

        # Retrieval truth queries.
        for query in TRUTH_QUERIES:
            state = capture_call("run_retrieval_test", {"query": query})
            lr = state.get("lastRetrieval") or {}
            result["truth_queries"].append(
                {
                    "query": query,
                    "answer": lr.get("answer"),
                    "passage_count": len(lr.get("passages") or []),
                    "passages": lr.get("passages") or [],
                    "generatedAt": lr.get("generatedAt"),
                }
            )

        # Remove source and verify retrieval behavior after delete.
        capture_call("remove_source", {"sourceId": source["id"]})
        post_delete_state = capture_call("run_retrieval_test", {"query": "What is ESB-1 rated for?"})
        post_delete_retrieval = post_delete_state.get("lastRetrieval") or {}

        # Capture final state and key assertions.
        final_state = capture_call("get_state")
        result["summary"] = {
            "ping_ok": bool(ping.get("ok")),
            "readiness_state": readiness.get("state"),
            "bridge_check": next((c for c in readiness.get("checks", []) if c.get("id") == "bridge_init"), {}),
            "initial_ingestion_job": terminal_job,
            "duplicate_ingestion_job": duplicate_terminal,
            "bad_extension_job": bad_job,
            "post_delete_retrieval": post_delete_retrieval,
            "final_runtime_status": final_state.get("runtime", {}).get("status"),
            "final_source_count": len(final_state.get("sources") or []),
            "final_job_count": len(final_state.get("jobs") or []),
            "final_index": final_state.get("index"),
        }
        result["state_snapshots"] = {
            "after_initial_ingest": latest_state,
            "final_state": final_state,
        }
    except Exception as exc:  # noqa: BLE001
        result["error"] = str(exc)
    finally:
        stderr_text = ""
        if proc.stderr is not None:
            try:
                stderr_text = proc.stderr.read()
            except Exception:
                stderr_text = ""
        ERR_LOG.write_text(stderr_text, encoding="utf-8")
        client.close()

    result["timestamps"]["finished_at_unix"] = time.time()
    OUT_JSON.write_text(json.dumps(result, indent=2, ensure_ascii=True), encoding="utf-8")
    if "error" in result:
        print(f"ERROR: {result['error']}")
        print(f"raw result written to {OUT_JSON}")
        return 1
    print(f"success; raw result written to {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
