#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import fnmatch
import json
import logging
import multiprocessing as mp
import os
import re
import sys
import threading
import mimetypes
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

logging.basicConfig(level=os.environ.get("SOPHON_LOG_LEVEL", "INFO").upper())
log = logging.getLogger("sophon-runtime")
STAGES = ["enumerate", "classify", "extract", "normalize", "chunk", "embed", "index", "validate", "publish"]
DEFAULT_ALLOWED_EXTENSIONS = [
    ".pdf",
    ".docx",
    ".dwg",
    ".dxf",
    ".ifc",
    ".xlsx",
    ".csv",
    ".txt",
    ".jpg",
    ".png",
    ".md",
]
LEGACY_INCLUDE_PATTERNS = {
    "*.pdf",
    "*.docx",
    "*.md",
    "**/*.pdf",
    "**/*.docx",
    "**/*.md",
}
EXTENSION_GLOB_RE = re.compile(r"^(?:\*\*/)?\*\.(?P<ext>[a-zA-Z0-9]+)$")
REJECTION_SAMPLE_LIMIT = 8


def configure_child_python_executable() -> None:
    """
    Keep spawned Python children on the same interpreter as this worker.
    On Windows, third-party multiprocessing code can otherwise drift to the
    base system Python and fail bridge imports.
    """
    os.environ["PYTHONEXECUTABLE"] = sys.executable
    if os.name == "nt":
        try:
            mp.set_executable(sys.executable)
        except Exception:
            pass


def configure_runtime_temp_dir() -> Path:
    configured = str(os.environ.get("TEMP_DIR") or "").strip()
    if configured:
        temp_dir = Path(configured).expanduser()
    else:
        app_data = str(os.environ.get("SOPHON_APP_DATA_DIR") or "").strip()
        if app_data:
            temp_dir = Path(app_data).expanduser() / "tmp-data"
        else:
            temp_dir = Path.home() / ".korda-tools" / "tmp-data"

    temp_dir.mkdir(parents=True, exist_ok=True)
    resolved = str(temp_dir.resolve())

    if not configured:
        os.environ["TEMP_DIR"] = resolved

    for variable in ("TMPDIR", "TMP", "TEMP"):
        os.environ.setdefault(variable, os.environ.get("TEMP_DIR", resolved))

    return temp_dir


configure_child_python_executable()
RUNTIME_TEMP_DIR = configure_runtime_temp_dir()
log.info(
    "Sophon runtime startup context: temp_dir=%s cwd=%s",
    os.environ.get("TEMP_DIR") or str(RUNTIME_TEMP_DIR),
    os.getcwd(),
)


def now() -> str:
    return datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")


def rid(prefix: str) -> str:
    return f"{prefix}-{uuid4()}"


def intv(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except Exception:
        return fallback


def elapsed_seconds_since(timestamp: Any) -> float | None:
    raw = str(timestamp or "").strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    delta = datetime.now(tz=UTC) - parsed.astimezone(UTC)
    return max(0.0, delta.total_seconds())


def normalize_payload(payload: Any) -> dict[str, Any]:
    if payload is None:
        return {}
    if isinstance(payload, dict):
        return payload
    if hasattr(payload, "model_dump"):
        return payload.model_dump()  # type: ignore[attr-defined]
    if hasattr(payload, "dict"):
        return payload.dict()  # type: ignore[attr-defined]
    return {"value": str(payload)}


def summarize_dependency_failures(payload: dict[str, Any], groups: list[str]) -> list[str]:
    failures: list[str] = []
    for group in groups:
        rows = payload.get(group)
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            status = str(row.get("status") or "unknown").lower()
            if status in {"healthy", "ok", "ready", "pass"}:
                continue
            service = str(row.get("service") or group)
            reason = str(row.get("error") or row.get("message") or status)
            failures.append(f"{service}: {reason}")
    return failures


def match_glob_pattern(relative_path: str, pattern: str) -> bool:
    normalized_pattern = str(pattern or "").strip()
    if not normalized_pattern:
        return False
    if fnmatch.fnmatch(relative_path, normalized_pattern):
        return True
    if normalized_pattern.startswith("**/"):
        # `**/*.pdf` should also match `file.pdf` in the source root.
        return fnmatch.fnmatch(relative_path, normalized_pattern[3:])
    return False


def normalize_extension(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return ""
    return normalized if normalized.startswith(".") else f".{normalized}"


def split_concatenated_glob_patterns(raw: str) -> list[str]:
    value = str(raw or "").strip()
    if not value:
        return []
    pieces: list[str] = []
    start = 0
    next_idx = value.find("**/", 1)
    while next_idx != -1:
        pieces.append(value[start:next_idx])
        start = next_idx
        next_idx = value.find("**/", next_idx + 3)
    pieces.append(value[start:])
    return [piece for piece in pieces if piece.strip()]


def dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def normalize_glob_patterns(values: Any, fallback: list[str] | None = None) -> list[str]:
    if values is None:
        return list(fallback or [])
    raw_values = values if isinstance(values, list) else [values]
    tokens: list[str] = []
    for raw in raw_values:
        text = str(raw or "")
        for part in text.replace(";", ",").replace("\n", ",").split(","):
            for nested in split_concatenated_glob_patterns(part):
                token = nested.strip().replace("\\", "/")
                if token:
                    tokens.append(token)
    normalized = dedupe_preserve_order(tokens)
    return normalized if normalized else list(fallback or [])


def extract_pattern_extensions(patterns: list[str]) -> set[str]:
    out: set[str] = set()
    for pattern in patterns:
        match = EXTENSION_GLOB_RE.match(str(pattern or "").strip().lower())
        if not match:
            continue
        out.add(normalize_extension(match.group("ext")))
    return {item for item in out if item}


def build_extension_include_patterns(extensions: set[str]) -> list[str]:
    patterns: list[str] = []
    for extension in sorted(extensions):
        if not extension.startswith(".") or len(extension) <= 1:
            continue
        suffix = extension[1:]
        patterns.append(f"*.{suffix}")
        patterns.append(f"**/*.{suffix}")
    return patterns


def normalize_source_file_filters(
    settings: dict[str, Any],
) -> tuple[list[str], list[str], set[str], list[str], list[str]]:
    include_configured = normalize_glob_patterns(settings.get("includePatterns"), fallback=["**/*"])
    exclude_patterns = normalize_glob_patterns(settings.get("excludePatterns"), fallback=["**/~$*", "**/.tmp/**"])
    allowed = {
        normalize_extension(value)
        for value in (settings.get("allowedExtensions") or list(DEFAULT_ALLOWED_EXTENSIONS))
        if normalize_extension(value)
    }
    if not allowed:
        allowed = {normalize_extension(value) for value in DEFAULT_ALLOWED_EXTENSIONS}

    include_extensions = extract_pattern_extensions(include_configured)
    all_include_are_extension_globs = bool(include_configured) and all(
        EXTENSION_GLOB_RE.match(str(pattern or "").strip().lower()) for pattern in include_configured
    )
    include_effective = list(include_configured)
    auto_expanded_extensions: list[str] = []

    # Heal legacy/include-subset sources: if include globs represent extension-only patterns,
    # ensure every allowed extension is reachable by include matching.
    if all_include_are_extension_globs and include_extensions and allowed:
        missing_extensions = sorted(
            extension for extension in allowed if extension not in include_extensions
        )
        if missing_extensions:
            include_effective = dedupe_preserve_order(
                [*include_configured, *build_extension_include_patterns(set(missing_extensions))]
            )
            auto_expanded_extensions = missing_extensions

    return (
        include_configured,
        include_effective,
        allowed,
        exclude_patterns,
        auto_expanded_extensions,
    )


def http_get_json(url: str, timeout_sec: int = 8) -> dict[str, Any]:
    request = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(request, timeout=timeout_sec) as response:
        body = response.read().decode("utf-8", errors="replace")
        parsed = json.loads(body)
        if not isinstance(parsed, dict):
            return {"raw": parsed}
        return parsed


def http_json_request(
    url: str,
    method: str = "GET",
    payload: dict[str, Any] | list[Any] | None = None,
    timeout_sec: int = 30,
) -> dict[str, Any]:
    data: bytes | None = None
    headers: dict[str, str] = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout_sec) as response:
        body = response.read().decode("utf-8", errors="replace")
        if not body.strip():
            return {}
        parsed = json.loads(body)
        if not isinstance(parsed, dict):
            return {"raw": parsed}
        return parsed


def encode_multipart_form_data(
    fields: dict[str, str],
    files: list[tuple[str, Path]],
) -> tuple[str, bytes]:
    boundary = f"----SophonBoundary{uuid4().hex}"
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )

    for field_name, path in files:
        filename = path.name
        mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        file_bytes = path.read_bytes()
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                (
                    f'Content-Disposition: form-data; name="{field_name}"; '
                    f'filename="{filename}"\r\n'
                ).encode("utf-8"),
                f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"),
                file_bytes,
                b"\r\n",
            ]
        )

    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(chunks)
    return f"multipart/form-data; boundary={boundary}", body


def http_post_multipart(
    url: str,
    fields: dict[str, str],
    files: list[tuple[str, Path]],
    timeout_sec: int = 120,
) -> dict[str, Any]:
    content_type, body = encode_multipart_form_data(fields, files)
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": content_type},
    )
    with urllib.request.urlopen(request, timeout=timeout_sec) as response:
        raw = response.read().decode("utf-8", errors="replace")
        if not raw.strip():
            return {}
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return {"raw": parsed}
        return parsed


def state_template() -> dict[str, Any]:
    return {
        "version": 1,
        "runtime": {"transport": "ipc_stdio", "engineMode": "embedded_nvidia", "status": "stopped", "gpuAvailable": False, "modelLoaded": False, "vectorStoreReady": False, "diskUsagePct": 0, "queueDepth": 0, "activeWorkers": 0},
        "role": "admin",
        "offlineOnlyEnforced": True,
        "egressBlocked": False,
        "blockedEgressAttempts": [],
        "crossClientMixingPrevented": True,
        "sources": [],
        "jobs": [],
        "index": {"docCount": 0, "chunkCount": 0, "embeddingModel": "nvidia/llama-3.2-nv-embedqa-1b-v2", "integrityStatus": "unknown", "revision": 1, "snapshots": []},
        "tuning": {"embeddingModel": "nvidia/llama-3.2-nv-embedqa-1b-v2", "retrieverTopK": 20, "rerankerEnabled": True, "rerankerThreshold": 0.2, "scoreThreshold": 0.15, "contextWindowTokens": 32768, "responseMaxTokens": 8192, "explainRetrieval": False, "maxIngestionWorkers": 4, "forceCpuOnly": False},
        "metrics": [],
        "logs": [],
        "audit": [],
        "activity": ["Sophon runtime worker initialized."],
    }


class NvidiaBridge:
    def __init__(self) -> None:
        self.collection = os.environ.get("SOPHON_COLLECTION_NAME", "multimodal_data")
        self.ingestor_base_url = (
            str(os.environ.get("SOPHON_INGESTOR_BASE_URL", "http://localhost:8082/v1")).rstrip("/")
        )
        self.use_ingestor_http = str(
            os.environ.get("SOPHON_USE_INGESTOR_HTTP", "true")
        ).strip().lower() not in {"0", "false", "no", "off"}
        self.ingestor_http_ready = False
        self.err: str | None = None
        self.ingestor: Any = None
        self.rag: Any = None
        self.ingestor_cls: Any = None
        self.rag_cls: Any = None
        self._init_complete = False
        self._init_lock = threading.Lock()
        self._clients_init_complete = False
        self._clients_init_lock = threading.Lock()

    def _init_impl(self) -> None:
        try:
            src = os.environ.get("SOPHON_KORDA_RAG_SRC")
            if src:
                sys.path.insert(0, src)
            from nvidia_rag.ingestor_server.main import NvidiaRAGIngestor
            from nvidia_rag.rag_server.main import NvidiaRAG

            self.ingestor_cls = NvidiaRAGIngestor
            self.rag_cls = NvidiaRAG
        except Exception as exc:
            self.err = f"NVIDIA bridge init failed: {exc}"

    def _ensure_initialized(self) -> None:
        if self._init_complete:
            return
        with self._init_lock:
            if self._init_complete:
                return
            timeout_sec = max(3, intv(os.environ.get("SOPHON_BRIDGE_INIT_TIMEOUT_SEC"), 180))
            thread = threading.Thread(target=self._init_impl, daemon=True)
            thread.start()
            thread.join(timeout=timeout_sec)
            if thread.is_alive():
                self.err = (
                    f"NVIDIA bridge initialization timed out after {timeout_sec}s. "
                    "Check KORDA-RAG dependencies and API key configuration."
                )
                return
            self._init_complete = True

    def _init_clients_impl(self) -> None:
        try:
            if self.ingestor is None and self.ingestor_cls is not None:
                self.ingestor = self.ingestor_cls(mode="library")
            if self.rag is None and self.rag_cls is not None:
                self.rag = self.rag_cls()
        except Exception as exc:
            self.err = f"NVIDIA bridge client init failed: {exc}"

    def _ensure_clients_initialized(self) -> None:
        if self._clients_init_complete:
            return
        with self._clients_init_lock:
            if self._clients_init_complete:
                return
            timeout_sec = max(5, intv(os.environ.get("SOPHON_BRIDGE_CLIENT_INIT_TIMEOUT_SEC"), 60))
            thread = threading.Thread(target=self._init_clients_impl, daemon=True)
            thread.start()
            thread.join(timeout=timeout_sec)
            if thread.is_alive():
                self.err = (
                    f"NVIDIA bridge client initialization timed out after {timeout_sec}s. "
                    "This usually indicates local backend dependency reachability issues."
                )
                return
            self._clients_init_complete = True

    @property
    def import_ready(self) -> bool:
        self._ensure_initialized()
        return self.err is None and self.ingestor_cls is not None and self.rag_cls is not None

    @property
    def ready(self) -> bool:
        self._ensure_initialized()
        if self.err is not None:
            return False
        self._ensure_clients_initialized()
        return self.err is None and self.ingestor is not None and self.rag is not None

    def arun(self, coroutine):
        return asyncio.run(coroutine)

    def _ensure_ingestor_http_ready(self) -> bool:
        if not self.use_ingestor_http:
            return False
        if self.ingestor_http_ready:
            return True
        try:
            _ = http_get_json(f"{self.ingestor_base_url}/health", timeout_sec=4)
            self.ingestor_http_ready = True
            return True
        except Exception:
            return False

    def _ensure_collection_via_http(self) -> None:
        collections_payload = http_get_json(
            f"{self.ingestor_base_url}/collections",
            timeout_sec=20,
        )
        rows = collections_payload.get("collections") or []
        for row in rows:
            if str((row or {}).get("collection_name") or "").strip() == self.collection:
                return
        _ = http_json_request(
            f"{self.ingestor_base_url}/collection",
            method="POST",
            payload={"collection_name": self.collection},
            timeout_sec=30,
        )

    def _upload_via_http(self, files: list[str], chunk: int, overlap: int) -> dict[str, Any]:
        self._ensure_collection_via_http()
        upload_payload = {
            "collection_name": self.collection,
            "blocking": False,
            "split_options": {"chunk_size": max(1, int(chunk)), "chunk_overlap": max(0, int(overlap))},
            "custom_metadata": [],
            "generate_summary": False,
            "documents_catalog_metadata": [],
            "summary_options": None,
            "enable_pdf_split_processing": False,
            "pdf_split_processing_options": {"pages_per_chunk": 16},
        }
        multipart_files: list[tuple[str, Path]] = []
        for file_path in files:
            path = Path(file_path)
            if not path.exists():
                raise FileNotFoundError(f"source file does not exist: {file_path}")
            multipart_files.append(("documents", path))
        return http_post_multipart(
            f"{self.ingestor_base_url}/documents",
            fields={"data": json.dumps(upload_payload)},
            files=multipart_files,
            timeout_sec=180,
        )

    def _task_via_http(self, task_id: str) -> dict[str, Any]:
        query = urllib.parse.urlencode({"task_id": task_id})
        return http_get_json(f"{self.ingestor_base_url}/status?{query}", timeout_sec=45)

    def _docs_via_http(self) -> dict[str, Any]:
        query = urllib.parse.urlencode({"collection_name": self.collection})
        return http_get_json(f"{self.ingestor_base_url}/documents?{query}", timeout_sec=30)

    def ensure_collection(self) -> None:
        if self._ensure_ingestor_http_ready():
            self._ensure_collection_via_http()
            return
        if not self.ready:
            raise RuntimeError(self.err or "bridge unavailable")
        self.ingestor.create_collection(collection_name=self.collection)

    def docs(self) -> dict[str, Any]:
        if self._ensure_ingestor_http_ready():
            return self._docs_via_http()
        if not self.ready:
            raise RuntimeError(self.err or "bridge unavailable")
        return self.ingestor.get_documents(collection_name=self.collection)

    def rebuild_collection(self) -> None:
        if self._ensure_ingestor_http_ready():
            try:
                _ = http_json_request(
                    f"{self.ingestor_base_url}/collections",
                    method="DELETE",
                    payload=[self.collection],
                    timeout_sec=30,
                )
            except Exception:
                pass
            self._ensure_collection_via_http()
            return
        if not self.ready:
            raise RuntimeError(self.err or "bridge unavailable")
        try:
            self.ingestor.delete_collections([self.collection])
        except Exception:
            pass
        self.ingestor.create_collection(collection_name=self.collection)

    def upload(self, files: list[str], chunk: int, overlap: int) -> dict[str, Any]:
        if self._ensure_ingestor_http_ready():
            try:
                return self._upload_via_http(files=files, chunk=chunk, overlap=overlap)
            except Exception as exc:
                log.warning(
                    "HTTP ingestion path failed, falling back to in-process bridge: %s",
                    exc,
                )
        if not self.ready:
            raise RuntimeError(self.err or "bridge unavailable")
        return self.arun(self.ingestor.upload_documents(filepaths=files, blocking=False, collection_name=self.collection, split_options={"chunk_size": chunk, "chunk_overlap": overlap}, generate_summary=True))

    def task(self, task_id: str) -> dict[str, Any]:
        if self._ensure_ingestor_http_ready():
            try:
                return self._task_via_http(task_id)
            except Exception as exc:
                log.warning(
                    "HTTP task status path failed, falling back to in-process bridge: %s",
                    exc,
                )
        if not self.ready:
            raise RuntimeError(self.err or "bridge unavailable")
        return self.arun(self.ingestor_cls.status(task_id))

    def search(self, query: str, topk: int, rerank: bool, threshold: float) -> dict[str, Any]:
        if not self.ready:
            raise RuntimeError(self.err or "bridge unavailable")
        citations = self.arun(self.rag.search(query=query, collection_names=[self.collection], reranker_top_k=max(1, topk), vdb_top_k=max(25, topk * 2), enable_reranker=rerank, confidence_threshold=threshold, enable_citations=True))
        if hasattr(citations, "model_dump"):
            return citations.model_dump()
        return citations if isinstance(citations, dict) else {"results": []}


class Runtime:
    def __init__(self) -> None:
        root = Path(os.environ.get("SOPHON_APP_DATA_DIR") or (Path.home() / ".korda-tools"))
        root.mkdir(parents=True, exist_ok=True)
        self.path = root / "sophon_runtime_state.json"
        self.state = self._load()
        self.bridge = NvidiaBridge()
        self.task_for_job: dict[str, str] = {}
        self._restore_task_mapping()
        if self.bridge.err:
            self.state["logs"] = [
                {"id": rid("log"), "ts": now(), "severity": "warn", "source": "runtime", "message": self.bridge.err},
                *self.state["logs"],
            ][:15000]

    def _restore_task_mapping(self) -> None:
        restored = 0
        failed_missing_task = 0
        for job in self.state.get("jobs") or []:
            status = str(job.get("status") or "").strip().lower()
            if status in {"completed", "failed", "cancelled", "paused"}:
                continue
            checkpoints = job.get("checkpoints") or []
            task_id = ""
            for checkpoint in reversed(checkpoints):
                cursor = str((checkpoint or {}).get("cursor") or "").strip()
                if cursor.startswith("task_id:"):
                    task_id = cursor.split("task_id:", 1)[1].strip()
                    if task_id:
                        break
            if task_id:
                self.task_for_job[str(job.get("id") or "")] = task_id
                restored += 1
                continue

            if status in {"running", "queued"}:
                job["status"] = "failed"
                job["failureReason"] = (
                    "Recovered ingestion job had no backend task reference after restart. "
                    "Re-queue ingestion for this source."
                )
                job["endedAt"] = now()
                job["currentStage"] = "extract"
                self.stage(job, "extract", "failed", 100)
                failed_missing_task += 1

        if restored > 0:
            self.append_log(
                "info",
                "runtime",
                f"Recovered {restored} in-flight ingestion task mapping(s) from persisted checkpoints.",
            )
        if failed_missing_task > 0:
            self.append_log(
                "warn",
                "runtime",
                f"Marked {failed_missing_task} recovered ingestion job(s) failed due to missing task references.",
            )
        if restored > 0 or failed_missing_task > 0:
            self.save()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return state_template()
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(payload, dict) and payload.get("version") == 1:
                if payload.get("runtimeReadiness") is None:
                    payload.pop("runtimeReadiness", None)
                return payload
        except Exception:
            pass
        return state_template()

    def save(self) -> None:
        self.path.write_text(json.dumps(self.state, ensure_ascii=True, indent=2), encoding="utf-8")

    def audit(self, action: str, entity_type: str, entity_id: str, details: str, severity: str = "info") -> None:
        self.state["audit"] = [{"id": rid("audit"), "actorId": "local-admin", "action": action, "entityType": entity_type, "entityId": entity_id, "details": details, "eventTsUtc": now(), "severity": severity}, *self.state["audit"]][:10000]

    def activity(self, message: str) -> None:
        self.state["activity"] = [f"{now()} {message}", *self.state["activity"]][:2000]

    def stage(self, job: dict[str, Any], name: str, status: str, pct: int) -> None:
        for st in job["stages"]:
            if st["stage"] == name:
                st["status"] = status
                st["progressPct"] = max(0, min(100, pct))
                break

    def refresh_index(self, allow_init: bool = True) -> None:
        bridge_loaded = self.bridge.ingestor is not None and self.bridge.rag is not None and self.bridge.err is None
        if allow_init:
            bridge_loaded = self.bridge.ready
        if not bridge_loaded:
            return
        try:
            payload = self.bridge.docs()
            docs = payload.get("documents") or []
            self.state["index"]["docCount"] = intv(payload.get("total_documents"), len(docs))
            self.state["index"]["chunkCount"] = max(self.state["index"]["docCount"], sum(intv((d.get("document_info") or {}).get("chunk_count"), 0) for d in docs))
            self.state["index"]["integrityStatus"] = "healthy"
            self.state["index"]["lastUpdatedAt"] = now()
        except Exception as exc:
            self.state["logs"] = [{"id": rid("log"), "ts": now(), "severity": "warn", "source": "index", "message": f"Index refresh failed: {exc}"}, *self.state["logs"]][:15000]

    def refresh_jobs(self) -> None:
        pending_timeout_sec = max(60, intv(os.environ.get("SOPHON_INGEST_PENDING_TIMEOUT_SEC"), 900))
        for job in self.state["jobs"]:
            if job["status"] in {"completed", "failed", "cancelled", "paused"}:
                continue
            task_id = self.task_for_job.get(job["id"])
            if not task_id:
                continue
            try:
                payload = self.bridge.task(task_id)
            except Exception as exc:
                job["status"] = "failed"; job["failureReason"] = str(exc); job["endedAt"] = now(); self.task_for_job.pop(job["id"], None); continue
            state = payload.get("state")
            dstat = ((payload.get("nv_ingest_status") or {}).get("document_wise_status") or {})
            total = max(1, len(dstat))
            done = sum(1 for v in dstat.values() if str(v).lower() in {"completed", "finished", "done", "success"})
            progress = int((done / total) * 100)
            status_counts: dict[str, int] = {}
            for raw_status in dstat.values():
                normalized = str(raw_status or "unknown").strip().lower() or "unknown"
                status_counts[normalized] = status_counts.get(normalized, 0) + 1
            top_status_fragments = [f"{key}:{value}" for key, value in sorted(status_counts.items())[:6]]
            status_summary = ", ".join(top_status_fragments) if top_status_fragments else "none"
            self.stage(job, "enumerate", "completed", 100); self.stage(job, "classify", "completed", 100)
            if state in {"PENDING", "RUNNING", "STARTED", "IN_PROGRESS"}:
                elapsed = elapsed_seconds_since(job.get("startedAt"))
                if elapsed is not None and elapsed > pending_timeout_sec:
                    timeout_reason = (
                        f"Ingestion task {task_id} remained pending for {int(elapsed)}s "
                        f"(timeout={pending_timeout_sec}s). NV-Ingest document status counts: {status_summary}. "
                        "Check NV-Ingest task execution, source parsing, and dependencies."
                    )
                    job["status"] = "failed"; job["failureReason"] = timeout_reason; job["endedAt"] = now()
                    self.task_for_job.pop(job["id"], None)
                    self.append_log("warn", "ingestion", timeout_reason)
                    continue
                job["status"] = "running"; job["currentStage"] = "extract"; self.stage(job, "extract", "running", max(2, progress)); job["discoveredFiles"] = total; job["processedDocuments"] = done
            elif state == "FINISHED":
                result = payload.get("result") or {}
                completed_docs = intv(result.get("documents_completed"), done)
                failed_docs = len(result.get("failed_documents") or [])
                produced_chunks = max(0, intv(result.get("batches_completed"), 0))
                if completed_docs <= 0 and failed_docs > 0:
                    sample_failed = [
                        str((row or {}).get("document_name") or "").strip()
                        for row in (result.get("failed_documents") or [])[:3]
                        if str((row or {}).get("document_name") or "").strip()
                    ]
                    failure_reason = str(result.get("message") or "Ingestion completed with zero successful documents.").strip()
                    if sample_failed:
                        failure_reason = (
                            f"{failure_reason} Failed documents: {', '.join(sample_failed)}."
                        )
                    job["status"] = "failed"; job["endedAt"] = now(); job["currentStage"] = "extract"
                    self.stage(job, "extract", "failed", 100)
                    job["failureReason"] = failure_reason
                    job["processedDocuments"] = 0
                    job["failedDocuments"] = failed_docs
                    job["producedChunks"] = produced_chunks
                    self.append_log("warn", "ingestion", failure_reason)
                else:
                    job["status"] = "completed"; job["endedAt"] = now(); job["currentStage"] = "publish"
                    for name in STAGES:
                        self.stage(job, name, "completed", 100)
                    job["processedDocuments"] = completed_docs
                    job["failedDocuments"] = failed_docs
                    job["producedChunks"] = produced_chunks
                    if failed_docs > 0:
                        self.append_log(
                            "warn",
                            "ingestion",
                            f"Ingestion completed with {failed_docs} failed documents.",
                        )
                    self.refresh_index()
                self.task_for_job.pop(job["id"], None)
            elif state in {"FAILED", "UNKNOWN", "NOT_FOUND", "CANCELLED"}:
                result = payload.get("result") or {}
                failure_reason = str(result.get("message") or f"Ingestion task ended with state={state}.")
                if state in {"UNKNOWN", "NOT_FOUND"} and "not found" in failure_reason.lower():
                    failure_reason = (
                        f"{failure_reason} Backend task record is missing. "
                        "This usually happens after ingestion backend restart; re-queue ingestion."
                    )
                job["status"] = "failed"
                job["failureReason"] = failure_reason
                job["endedAt"] = now()
                job["currentStage"] = "extract"
                self.stage(job, "extract", "failed", 100)
                self.task_for_job.pop(job["id"], None)
        self.state["runtime"]["queueDepth"] = sum(1 for j in self.state["jobs"] if j["status"] == "queued")
        self.state["runtime"]["activeWorkers"] = sum(1 for j in self.state["jobs"] if j["status"] == "running")
        self.state["runtime"]["diskUsagePct"] = max(1, min(99, intv(self.state["index"]["chunkCount"] / 32, 1)))
        self.state["runtime"]["lastHealthCheckAt"] = now()

    def append_log(self, severity: str, source: str, message: str) -> None:
        latest = (self.state.get("logs") or [None])[0]
        if (
            isinstance(latest, dict)
            and latest.get("severity") == severity
            and latest.get("source") == source
            and latest.get("message") == message
        ):
            return
        self.state["logs"] = [
            {
                "id": rid("log"),
                "ts": now(),
                "severity": severity,
                "source": source,
                "message": message,
            },
            *self.state["logs"],
        ][:15000]

    def _readiness_item(
        self,
        item_id: str,
        title: str,
        status: str,
        message: str,
        remediation: list[str],
        *,
        blocking: bool = False,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "id": item_id,
            "title": title,
            "status": status,
            "blocking": blocking,
            "message": message,
            "remediation": remediation,
            "details": details or {},
        }

    def evaluate_runtime_readiness(self) -> dict[str, Any]:
        checks: list[dict[str, Any]] = []

        py_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        if sys.version_info >= (3, 14):
            checks.append(
                self._readiness_item(
                    "python_runtime",
                    "Python runtime compatibility",
                    "fail",
                    f"Python {py_version} is not supported for full Sophon/KORDA-RAG compatibility.",
                    [
                        "Install Python 3.12 (or 3.11) and point Sophon to it via SOPHON_PYTHON_BIN.",
                        "Restart KORDA TOOLS after setting SOPHON_PYTHON_BIN.",
                    ],
                    blocking=True,
                    details={"detectedVersion": py_version},
                )
            )
        elif sys.version_info < (3, 11):
            checks.append(
                self._readiness_item(
                    "python_runtime",
                    "Python runtime compatibility",
                    "fail",
                    f"Python {py_version} is below supported baseline (3.11+ required).",
                    [
                        "Install Python 3.12 (recommended) and set SOPHON_PYTHON_BIN.",
                    ],
                    blocking=True,
                    details={"detectedVersion": py_version},
                )
            )
        else:
            checks.append(
                self._readiness_item(
                    "python_runtime",
                    "Python runtime compatibility",
                    "pass",
                    f"Python {py_version} is compatible.",
                    [],
                    details={"detectedVersion": py_version},
                )
            )

        try:
            import torch  # noqa: F401

            checks.append(
                self._readiness_item(
                    "torch_runtime",
                    "PyTorch availability",
                    "pass",
                    "PyTorch is installed.",
                    [],
                )
            )
        except Exception:
            checks.append(
                self._readiness_item(
                    "torch_runtime",
                    "PyTorch availability",
                    "warn",
                    "PyTorch is not installed. Some model-backed flows may be unavailable.",
                    [
                        "Install torch in the Python environment used by Sophon.",
                        "For CPU-only environments use the PyTorch CPU wheel index.",
                    ],
                )
            )

        api_key = (os.environ.get("NVIDIA_API_KEY") or os.environ.get("NGC_API_KEY") or "").strip()
        hosted_egress_enabled = not bool(self.state.get("egressBlocked", False))
        if hosted_egress_enabled and not api_key:
            checks.append(
                self._readiness_item(
                    "api_key",
                    "NVIDIA API key",
                    "fail",
                    "Hosted inference is enabled but no NVIDIA API key is configured.",
                    [
                        "Open Sophon -> Settings -> NVIDIA API Key and save a valid key (nvapi-...).",
                        "Or disable hosted inference egress to run in strict offline-only mode.",
                    ],
                    blocking=True,
                    details={"hostedInferenceEnabled": True},
                )
            )
        elif api_key:
            checks.append(
                self._readiness_item(
                    "api_key",
                    "NVIDIA API key",
                    "pass",
                    "NVIDIA API key is configured for hosted inference.",
                    [],
                    details={"hostedInferenceEnabled": hosted_egress_enabled},
                )
            )
        else:
            checks.append(
                self._readiness_item(
                    "api_key",
                    "NVIDIA API key",
                    "warn",
                    "No API key is configured. Hosted inference will remain unavailable.",
                    [
                        "Save an NVIDIA API key in Sophon Settings if you want hosted LLM/embedding acceleration.",
                    ],
                    details={"hostedInferenceEnabled": hosted_egress_enabled},
                )
            )

        bridge_ready = self.bridge.ready
        if bridge_ready:
            checks.append(
                self._readiness_item(
                    "bridge_init",
                    "Sophon NVIDIA bridge",
                    "pass",
                    "NVIDIA RAG bridge loaded successfully.",
                    [],
                )
            )
        else:
            checks.append(
                self._readiness_item(
                    "bridge_init",
                    "Sophon NVIDIA bridge",
                    "fail",
                    self.bridge.err or "NVIDIA RAG bridge is not available.",
                    [
                        "Confirm KORDA-RAG sources are present and SOPHON_KORDA_RAG_SRC points to the KORDA-RAG src path.",
                        "Install local Python runtime dependencies required by KORDA-RAG.",
                        "Re-run Runtime Health from Sophon Settings after dependencies are fixed.",
                    ],
                    blocking=True,
                )
            )

        if bridge_ready:
            ingestor_health_url = os.environ.get(
                "SOPHON_INGESTOR_HEALTH_URL",
                "http://localhost:8082/v1/health?check_dependencies=true",
            )
            rag_health_url = os.environ.get(
                "SOPHON_RAG_HEALTH_URL",
                "http://localhost:8081/v1/health?check_dependencies=true",
            )

            try:
                # Prefer the external health endpoint so readiness matches live deployed stack behavior.
                ingestor_health = http_get_json(ingestor_health_url)
                ingestor_failures = summarize_dependency_failures(
                    ingestor_health,
                    ["databases", "object_storage", "processing", "task_management"],
                )
                if ingestor_failures:
                    checks.append(
                        self._readiness_item(
                            "ingestor_dependencies",
                            "Ingestor dependencies",
                            "fail",
                            "One or more ingestion dependencies are not healthy.",
                            [
                                "Start/repair local Milvus + MinIO + NV-Ingest + Redis prerequisites.",
                                "Re-run Runtime Health from Sophon Settings.",
                            ],
                            blocking=True,
                            details={"failures": ingestor_failures, "healthUrl": ingestor_health_url},
                        )
                    )
                else:
                    checks.append(
                        self._readiness_item(
                            "ingestor_dependencies",
                            "Ingestor dependencies",
                            "pass",
                            "Ingestor dependencies are healthy.",
                            [],
                            details={"healthUrl": ingestor_health_url},
                        )
                    )
            except Exception as exc:
                checks.append(
                    self._readiness_item(
                        "ingestor_dependencies",
                        "Ingestor dependencies",
                        "fail",
                        f"Ingestor health probe failed: {exc}",
                        [
                            "Verify local ingestion stack prerequisites are running and reachable.",
                            "Check Sophon runtime logs for dependency connection errors.",
                        ],
                        blocking=True,
                        details={"healthUrl": ingestor_health_url},
                    )
                )

            try:
                rag_health = http_get_json(rag_health_url)
                rag_failures = summarize_dependency_failures(rag_health, ["databases", "object_storage", "nim"])
                optional_failures = [
                    failure
                    for failure in rag_failures
                    if "Reflection LLM" in failure
                ]
                required_failures = [failure for failure in rag_failures if failure not in optional_failures]
                if rag_failures:
                    if required_failures:
                        checks.append(
                            self._readiness_item(
                                "rag_dependencies",
                                "Retrieval dependencies",
                                "fail",
                                "One or more retrieval dependencies are not healthy.",
                                [
                                    "Ensure Milvus/object storage dependencies are reachable for retrieval.",
                                    "If hosted inference is enabled, verify API key and provider reachability.",
                                ],
                                blocking=True,
                                details={"failures": required_failures, "healthUrl": rag_health_url},
                            )
                        )
                    else:
                        checks.append(
                            self._readiness_item(
                                "rag_dependencies",
                                "Retrieval dependencies",
                                "warn",
                                "Optional retrieval components are degraded (core retrieval remains available).",
                                [
                                    "Disable reflection if unused, or configure reflection backend endpoint.",
                                ],
                                details={"warnings": optional_failures, "healthUrl": rag_health_url},
                            )
                        )
                else:
                    checks.append(
                        self._readiness_item(
                            "rag_dependencies",
                            "Retrieval dependencies",
                            "pass",
                            "Retrieval dependencies are healthy.",
                            [],
                            details={"healthUrl": rag_health_url},
                        )
                    )
            except Exception as exc:
                checks.append(
                    self._readiness_item(
                        "rag_dependencies",
                        "Retrieval dependencies",
                        "fail",
                        f"RAG health probe failed: {exc}",
                        [
                            "Verify local RAG prerequisites are running and reachable.",
                            "Check hosted endpoint/API key settings if not in strict offline mode.",
                        ],
                        blocking=True,
                        details={"healthUrl": rag_health_url},
                    )
                )

            try:
                self.bridge.ensure_collection()
                docs_payload = self.bridge.docs()
                doc_count = intv(docs_payload.get("total_documents"), 0)
                checks.append(
                    self._readiness_item(
                        "collection_bootstrap",
                        "Collection bootstrap",
                        "pass",
                        f"Default collection '{self.bridge.collection}' is ready.",
                        [],
                        details={"collection": self.bridge.collection, "documentCount": doc_count},
                    )
                )
            except Exception as exc:
                checks.append(
                    self._readiness_item(
                        "collection_bootstrap",
                        "Collection bootstrap",
                        "fail",
                        f"Collection bootstrap failed: {exc}",
                        [
                            "Confirm Milvus is reachable and collection management is enabled.",
                            "Run Auto Remediate in Sophon Settings after dependencies recover.",
                        ],
                        blocking=True,
                    )
                )
        else:
            checks.append(
                self._readiness_item(
                    "ingestor_dependencies",
                    "Ingestor dependencies",
                    "warn",
                    "Dependency checks skipped because NVIDIA bridge is not initialized.",
                    ["Fix NVIDIA bridge initialization first."],
                )
            )
            checks.append(
                self._readiness_item(
                    "rag_dependencies",
                    "Retrieval dependencies",
                    "warn",
                    "Dependency checks skipped because NVIDIA bridge is not initialized.",
                    ["Fix NVIDIA bridge initialization first."],
                )
            )
            checks.append(
                self._readiness_item(
                    "collection_bootstrap",
                    "Collection bootstrap",
                    "warn",
                    "Collection bootstrap skipped because NVIDIA bridge is not initialized.",
                    ["Fix NVIDIA bridge initialization first."],
                )
            )

        source_count = len(self.state.get("sources") or [])
        if source_count > 0:
            checks.append(
                self._readiness_item(
                    "source_setup",
                    "Source setup",
                    "pass",
                    f"{source_count} source(s) configured for ingestion.",
                    [],
                )
            )
        else:
            checks.append(
                self._readiness_item(
                    "source_setup",
                    "Source setup",
                    "warn",
                    "No sources configured yet. Ingestion is not ready.",
                    ["Open Sophon -> Sources and add a folder/file source to start ingestion."],
                )
            )

        blocker_count = sum(1 for check in checks if check["status"] == "fail" and check.get("blocking"))
        warning_count = sum(1 for check in checks if check["status"] == "warn")
        readiness_state = "ready" if blocker_count == 0 else "blocked"
        if blocker_count == 0 and warning_count > 0:
            readiness_state = "degraded"

        summary = "Sophon enterprise readiness is healthy."
        if readiness_state == "blocked":
            summary = "Sophon is blocked by dependency or configuration failures."
        elif readiness_state == "degraded":
            summary = "Sophon is partially ready. Resolve warnings for full production quality."

        report = {
            "generatedAt": now(),
            "state": readiness_state,
            "summary": summary,
            "blockerCount": blocker_count,
            "warningCount": warning_count,
            "checks": checks,
        }
        return report

    def apply_runtime_readiness(self, report: dict[str, Any]) -> None:
        readiness_state = str(report.get("state") or "degraded")
        self.state["runtimeReadiness"] = report
        self.state["runtime"]["gpuAvailable"] = not bool(self.state["tuning"].get("forceCpuOnly", False))

        checks = report.get("checks") or []
        bridge_ok = any(
            isinstance(item, dict)
            and item.get("id") == "bridge_init"
            and item.get("status") == "pass"
            for item in checks
        )
        collection_ok = any(
            isinstance(item, dict)
            and item.get("id") == "collection_bootstrap"
            and item.get("status") == "pass"
            for item in checks
        )

        self.state["runtime"]["modelLoaded"] = bool(bridge_ok)
        self.state["runtime"]["vectorStoreReady"] = bool(collection_ok)
        self.state["runtime"]["status"] = "running" if readiness_state == "ready" else "degraded"
        if readiness_state != "ready":
            self.append_log("warn", "runtime", str(report.get("summary") or "Sophon readiness degraded."))

    def auto_remediate_readiness(self) -> dict[str, Any]:
        actions: list[str] = []
        if self.state.get("egressBlocked", False):
            actions.append("Hosted inference egress remains blocked (strict offline mode).")
        else:
            if not (os.environ.get("NVIDIA_API_KEY") or os.environ.get("NGC_API_KEY")):
                self.state["egressBlocked"] = True
                actions.append(
                    "No NVIDIA API key found. Switched to strict offline mode (egress blocked) to clear hosted-key blocker."
                )

        if self.bridge.ready:
            try:
                self.bridge.ensure_collection()
                actions.append(f"Ensured default collection '{self.bridge.collection}'.")
            except Exception as exc:
                actions.append(f"Collection bootstrap failed during remediation: {exc}")
        else:
            actions.append(self.bridge.err or "NVIDIA bridge is unavailable.")

        report = self.evaluate_runtime_readiness()
        self.apply_runtime_readiness(report)
        self.refresh_jobs()
        self.refresh_index(allow_init=False)
        self.audit(
            "sophon.runtime.auto_remediate",
            "runtime",
            "sophon",
            "; ".join(actions)[:1800],
            severity="warn" if report.get("state") != "ready" else "info",
        )
        self.save()
        return {"ok": True, "actions": actions, "readiness": report, "state": self.state}

    def enumerate_files(self, source: dict[str, Any]) -> tuple[list[str], dict[str, Any]]:
        source_path_raw = str(source.get("path") or "").strip()
        configured_source_type = str(source.get("sourceType") or "folder").strip().lower() or "folder"
        path = Path(source_path_raw).expanduser()
        settings = source.get("settings") or {}
        (
            include_configured,
            include_effective,
            allowed,
            exclude_patterns,
            auto_expanded_extensions,
        ) = normalize_source_file_filters(settings)
        max_size = max(1, intv(settings.get("maxFileSizeMb"), 1024)) * 1024 * 1024

        resolved_source_mode = "missing"
        if path.is_file():
            resolved_source_mode = "file"
        elif path.is_dir():
            resolved_source_mode = "folder"

        candidate_files: list[Path] = []
        if resolved_source_mode == "file":
            candidate_files = [path]
        elif resolved_source_mode == "folder":
            candidate_files = [item for item in path.rglob("*") if item.is_file()]

        rejected_by_include = 0
        rejected_by_exclude = 0
        rejected_by_extension = 0
        rejected_by_size = 0
        sample_rejections: list[dict[str, str]] = []

        def add_sample(file_path: Path, relative_path: str, reason: str) -> None:
            if len(sample_rejections) >= REJECTION_SAMPLE_LIMIT:
                return
            sample_rejections.append(
                {
                    "path": str(file_path),
                    "relativePath": relative_path,
                    "reason": reason,
                }
            )

        out: list[str] = []
        for file_path in candidate_files:
            relative_path = file_path.name if resolved_source_mode == "file" else file_path.relative_to(path).as_posix()
            if (
                resolved_source_mode == "folder"
                and include_effective
                and not any(match_glob_pattern(relative_path, pattern) for pattern in include_effective)
            ):
                rejected_by_include += 1
                add_sample(file_path, relative_path, "include_mismatch")
                continue
            if (
                resolved_source_mode == "folder"
                and exclude_patterns
                and any(match_glob_pattern(relative_path, pattern) for pattern in exclude_patterns)
            ):
                rejected_by_exclude += 1
                add_sample(file_path, relative_path, "excluded")
                continue
            if allowed and normalize_extension(file_path.suffix) not in allowed:
                rejected_by_extension += 1
                add_sample(file_path, relative_path, "extension_not_allowed")
                continue
            try:
                if file_path.stat().st_size > max_size:
                    rejected_by_size += 1
                    add_sample(file_path, relative_path, "size_exceeded")
                    continue
            except OSError:
                rejected_by_size += 1
                add_sample(file_path, relative_path, "stat_error")
                continue
            out.append(str(file_path.resolve()))

        diagnostics = {
            "sourcePath": source_path_raw,
            "configuredSourceType": configured_source_type,
            "resolvedSourceMode": resolved_source_mode,
            "candidateFileCount": len(candidate_files),
            "matchedFileCount": len(out),
            "configuredIncludePatterns": include_configured,
            "effectiveIncludePatterns": include_effective,
            "excludePatterns": exclude_patterns,
            "allowedExtensions": sorted(allowed),
            "autoExpandedIncludeExtensions": auto_expanded_extensions,
            "rejectedByInclude": rejected_by_include,
            "rejectedByExclude": rejected_by_exclude,
            "rejectedByExtension": rejected_by_extension,
            "rejectedBySize": rejected_by_size,
            "sampleRejections": sample_rejections,
        }
        return out, diagnostics

    def list_files(self, source: dict[str, Any]) -> list[str]:
        files, _ = self.enumerate_files(source)
        return files

    def handle(self, method: str, params: dict[str, Any]) -> Any:
        if method == "ping":
            return {"ok": True, "ts": now()}
        if method == "shutdown":
            return {"ok": True}
        if method == "get_state":
            self.refresh_jobs(); self.save(); return self.state
        if method in {"start_runtime", "run_health_check"}:
            report = self.evaluate_runtime_readiness()
            self.apply_runtime_readiness(report)
            self.refresh_jobs(); self.refresh_index(allow_init=False); self.save(); return self.state
        if method == "check_readiness":
            report = self.evaluate_runtime_readiness()
            self.apply_runtime_readiness(report)
            self.refresh_jobs(); self.refresh_index(allow_init=False); self.save(); return report
        if method == "auto_remediate":
            return self.auto_remediate_readiness()
        if method == "stop_runtime":
            self.state["runtime"]["status"] = "stopped"; self.state["runtime"]["modelLoaded"] = False; self.state["runtime"]["vectorStoreReady"] = False; self.save(); return self.state
        if method == "set_role":
            self.state["role"] = str(params.get("role") or "admin"); self.save(); return self.state
        if method == "set_egress_blocked":
            self.state["egressBlocked"] = bool(params.get("blocked", True))
            self.audit(
                "sophon.policy.egress.mode",
                "policy",
                "egress",
                "Outbound hosted inference egress disabled." if self.state["egressBlocked"] else "Outbound hosted inference egress enabled for approved providers.",
                severity="warn" if self.state["egressBlocked"] else "info",
            )
            report = self.evaluate_runtime_readiness()
            self.apply_runtime_readiness(report)
            self.save()
            return self.state
        if method == "add_source":
            name = str(params.get("name") or "").strip(); path = str(params.get("path") or "").strip()
            if not name or not path: raise ValueError("Source name and path are required.")
            created = now(); settings = {"includePatterns": params.get("includePatterns") or ["**/*"], "excludePatterns": params.get("excludePatterns") or ["**/~$*", "**/.tmp/**"], "allowedExtensions": params.get("allowedExtensions") or list(DEFAULT_ALLOWED_EXTENSIONS), "maxFileSizeMb": intv(params.get("maxFileSizeMb"), 1024), "maxPages": intv(params.get("maxPages"), 5000), "watchEnabled": bool(params.get("watchEnabled", False)), "watchIntervalSec": intv(params.get("watchIntervalSec"), 300), "debounceSeconds": intv(params.get("debounceSeconds"), 20), "dedupeStrategy": "sha256", "changeDetection": "mtime_size_hash", "retention": {"derivedArtifactsDays": 180, "snapshotRetentionDays": 365, "keepFailedJobArtifactsDays": 30}, "chunkSize": intv(params.get("chunkSize"), 1024), "chunkOverlap": intv(params.get("chunkOverlap"), 150), "pageAwareChunking": bool(params.get("pageAwareChunking", True)), "ocrEnabled": bool(params.get("ocrEnabled", True)), "extractionEnabled": bool(params.get("extractionEnabled", True))}
            src = {"id": rid("source"), "sourceType": params.get("sourceType") or "folder", "name": name, "path": path, "enabled": True, "settings": settings, "tags": params.get("tags") or ["sophon"], "sensitivity": params.get("sensitivity") or "Internal", "clientBoundaryTag": params.get("clientBoundaryTag"), "projectBoundaryTag": params.get("projectBoundaryTag"), "createdAt": created, "updatedAt": created}
            self.state["sources"] = [src, *self.state["sources"]][:500]; self.audit("sophon.sources.add", "source", src["id"], f"Added source {name}."); self.save(); return self.state
        if method == "update_source":
            sid = str(params.get("sourceId") or ""); patch = params.get("patch") or {}
            for src in self.state["sources"]:
                if src["id"] == sid:
                    src.update({k: v for k, v in patch.items() if k in {"name", "path", "enabled", "tags", "sensitivity"}}); src["updatedAt"] = now()
            self.save(); return self.state
        if method == "remove_source":
            sid = str(params.get("sourceId") or ""); self.state["sources"] = [s for s in self.state["sources"] if s["id"] != sid]; self.save(); return self.state
        if method == "queue_ingestion":
            sid = str(params.get("sourceId") or ""); src = next((s for s in self.state["sources"] if s["id"] == sid), None)
            if src is None: raise ValueError("Source not found.")
            existing_active_job = next(
                (
                    existing
                    for existing in self.state["jobs"]
                    if existing.get("sourceId") == sid and existing.get("status") in {"queued", "running", "paused"}
                ),
                None,
            )
            if existing_active_job is not None:
                existing_id = str(existing_active_job.get("id") or "")
                existing_stage = str(existing_active_job.get("currentStage") or "unknown")
                duplicate_message = (
                    f"Source '{src.get('name') or sid}' already has an active ingestion job "
                    f"({existing_id}) at stage '{existing_stage}'. Duplicate queue request ignored."
                )
                self.append_log("warn", "ingestion", duplicate_message)
                self.activity(duplicate_message)
                self.save()
                return self.state
            source_settings = src.get("settings") or {}
            (
                include_configured,
                include_effective,
                allowed_extensions,
                exclude_patterns,
                auto_expanded_extensions,
            ) = normalize_source_file_filters(source_settings)
            if (
                include_configured != include_effective
                or normalize_glob_patterns(source_settings.get("excludePatterns"), fallback=["**/~$*", "**/.tmp/**"]) != exclude_patterns
                or sorted(
                    {
                        normalize_extension(value)
                        for value in (source_settings.get("allowedExtensions") or list(DEFAULT_ALLOWED_EXTENSIONS))
                        if normalize_extension(value)
                    }
                )
                != sorted(allowed_extensions)
            ):
                src["settings"] = {
                    **source_settings,
                    "includePatterns": include_effective,
                    "excludePatterns": exclude_patterns,
                    "allowedExtensions": sorted(allowed_extensions),
                }
                src["updatedAt"] = now()
                if auto_expanded_extensions:
                    self.append_log(
                        "info",
                        "ingestion",
                        "Auto-healed source include patterns from allowedExtensions "
                        f"for source '{src.get('name') or sid}': {auto_expanded_extensions}",
                    )
            options = {"dryRun": bool(params.get("dryRun", False)), "safeMode": bool(params.get("safeMode", False)), "maxWorkers": max(1, min(128, intv(params.get("maxWorkers"), intv(self.state["tuning"]["maxIngestionWorkers"], 4))))}
            job = {"id": rid("job"), "sourceId": src["id"], "sourceName": src["name"], "status": "queued", "currentStage": "enumerate", "stages": [{"stage": stage, "status": "queued", "progressPct": 0, "filesProcessed": 0, "chunksProduced": 0, "errorCount": 0} for stage in STAGES], "checkpoints": [], "options": options, "startedAt": now(), "retries": 0, "discoveredFiles": 0, "processedDocuments": 0, "failedDocuments": 0, "producedChunks": 0, "blockedByPolicy": False, "validation": {"integrityPass": True, "retrievalSanityPass": True, "orphanedChunks": 0, "missingMetadataRows": 0, "warnings": [], "errors": []}}
            self.state["jobs"] = [job, *self.state["jobs"]][:5000]
            files, enumerate_diagnostics = self.enumerate_files(src); job["discoveredFiles"] = len(files); job["enumerateDiagnostics"] = enumerate_diagnostics
            if options["dryRun"]:
                for stage in STAGES: self.stage(job, stage, "completed", 100)
                job["status"] = "completed"; job["endedAt"] = now(); job["processedDocuments"] = len(files); self.save(); return self.state
            if not files:
                job["status"] = "failed"; job["failureReason"] = (
                    "No files matched source settings. "
                    f"SourcePath={enumerate_diagnostics['sourcePath']}; "
                    f"ConfiguredSourceType={enumerate_diagnostics['configuredSourceType']}; "
                    f"ResolvedSourceMode={enumerate_diagnostics['resolvedSourceMode']}; "
                    f"Candidates={enumerate_diagnostics['candidateFileCount']}; "
                    f"RejectedByInclude={enumerate_diagnostics['rejectedByInclude']}; "
                    f"RejectedByExclude={enumerate_diagnostics['rejectedByExclude']}; "
                    f"RejectedByExtension={enumerate_diagnostics['rejectedByExtension']}; "
                    f"RejectedBySize={enumerate_diagnostics['rejectedBySize']}; "
                    f"Include={enumerate_diagnostics['effectiveIncludePatterns']}; "
                    f"AllowedExtensions={enumerate_diagnostics['allowedExtensions']}; "
                    f"SampleRejections={enumerate_diagnostics['sampleRejections']}"
                ); job["endedAt"] = now(); self.save(); return self.state
            if not self.bridge.ready:
                job["status"] = "failed"; job["failureReason"] = self.bridge.err or "Bridge unavailable."; job["endedAt"] = now(); self.save(); return self.state
            self.bridge.ensure_collection()
            response = self.bridge.upload(files, intv(src["settings"]["chunkSize"], 1024), intv(src["settings"]["chunkOverlap"], 150))
            task_id = response.get("task_id")
            if task_id:
                self.task_for_job[job["id"]] = str(task_id); job["status"] = "running"; self.stage(job, "enumerate", "running", 5); job["checkpoints"] = [{"stage": "enumerate", "cursor": f"task_id:{task_id}", "persistedAt": now()}]
            else:
                job["status"] = "failed"; job["failureReason"] = str(response.get("message") or "Ingestion submit failed."); job["endedAt"] = now()
            self.save(); return self.state
        if method in {"pause_job", "resume_job", "cancel_job"}:
            jid = str(params.get("jobId") or ""); target = {"pause_job": "paused", "resume_job": "running", "cancel_job": "cancelled"}[method]
            for job in self.state["jobs"]:
                if job["id"] == jid and job["status"] not in {"completed", "failed", "cancelled"}:
                    job["status"] = target
                    if target == "cancelled": job["endedAt"] = now(); job["failureReason"] = "Cancelled by operator."
            self.save(); return self.state
        if method == "retry_job":
            jid = str(params.get("jobId") or ""); old = next((j for j in self.state["jobs"] if j["id"] == jid), None)
            return self.handle("queue_ingestion", {"sourceId": old["sourceId"], "dryRun": old["options"]["dryRun"], "safeMode": old["options"]["safeMode"], "maxWorkers": old["options"]["maxWorkers"]}) if old else self.state
        if method == "rebuild_index":
            if self.bridge.ready:
                self.bridge.rebuild_collection()
                for src in list(self.state["sources"]):
                    if src.get("enabled", True):
                        self.handle("queue_ingestion", {"sourceId": src["id"], "dryRun": False, "safeMode": False})
            self.refresh_index(); self.state["index"]["revision"] = intv(self.state["index"]["revision"], 1) + 1; self.state["index"]["lastUpdatedAt"] = now(); self.save(); return self.state
        if method == "compact_index":
            self.refresh_index(); self.state["index"]["revision"] = intv(self.state["index"]["revision"], 1) + 1; self.state["index"]["lastUpdatedAt"] = now(); self.save(); return self.state
        if method == "validate_index":
            self.refresh_index(); self.state["index"]["lastValidatedAt"] = now(); self.save(); return self.state
        if method == "create_snapshot":
            name = str(params.get("name") or "").strip() or f"snapshot-{datetime.now().strftime('%Y-%m-%d')}"
            snap = {"id": rid("snapshot"), "name": name, "createdAt": now(), "docCount": intv(self.state["index"]["docCount"], 0), "chunkCount": intv(self.state["index"]["chunkCount"], 0), "embeddingModel": self.state["index"]["embeddingModel"]}
            self.state["index"]["snapshots"] = [snap, *self.state["index"]["snapshots"]][:200]; self.state["index"]["activeSnapshotId"] = self.state["index"].get("activeSnapshotId") or snap["id"]; self.save(); return self.state
        if method == "restore_snapshot":
            sid = str(params.get("snapshotId") or ""); snap = next((s for s in self.state["index"]["snapshots"] if s["id"] == sid), None)
            if snap: self.state["index"]["docCount"] = intv(snap["docCount"], 0); self.state["index"]["chunkCount"] = intv(snap["chunkCount"], 0); self.state["index"]["embeddingModel"] = snap["embeddingModel"]; self.state["index"]["activeSnapshotId"] = sid; self.state["index"]["revision"] = intv(self.state["index"]["revision"], 1) + 1
            self.save(); return self.state
        if method == "publish_snapshot":
            self.state["index"]["activeSnapshotId"] = str(params.get("snapshotId") or ""); self.save(); return self.state
        if method == "update_tuning":
            patch = params.get("input") or {}
            for key in list(self.state["tuning"].keys()):
                if key in patch: self.state["tuning"][key] = patch[key]
            self.state["index"]["embeddingModel"] = self.state["tuning"]["embeddingModel"]; self.save(); return self.state
        if method == "run_retrieval_test":
            query = str(params.get("query") or "").strip()
            if not query: return self.state
            if self.state.get("egressBlocked", True) and ("http://" in query.lower() or "https://" in query.lower()):
                return self.handle("record_blocked_egress_attempt", {"target": query, "reason": "SOPHON_EGRESS_BLOCK_REQUIRED"})
            passages: list[dict[str, Any]] = []
            answer = ""
            enabled_source_ids = {
                str(source.get("id") or "")
                for source in (self.state.get("sources") or [])
                if bool(source.get("enabled", True))
            }
            completed_source_ids = {
                str(job.get("sourceId") or "")
                for job in (self.state.get("jobs") or [])
                if str(job.get("status") or "").lower() == "completed"
            }
            queryable_source_ids = enabled_source_ids.intersection(completed_source_ids)

            if not enabled_source_ids:
                answer = "No enabled sources are configured. Add a source in Sophon -> Sources before querying."
            elif not queryable_source_ids:
                answer = "No enabled sources are indexed yet. Run ingestion and wait for a completed job before querying."
            elif not self.bridge.ready:
                answer = self.bridge.err or "Retrieval backend is unavailable. Run Runtime Health and resolve blockers."
                self.append_log("warn", "retrieval", answer)
            else:
                try:
                    payload = self.bridge.search(query, intv(self.state["tuning"]["retrieverTopK"], 20), bool(self.state["tuning"]["rerankerEnabled"]), float(self.state["tuning"]["scoreThreshold"]))
                    for item in (payload.get("results") or [])[: max(1, intv(self.state["tuning"]["retrieverTopK"], 20))]:
                        passages.append({"sourceName": str(item.get("document_name") or "unknown"), "score": float(item.get("score") or 0.0), "content": str(item.get("content") or "")[:3000]})
                except Exception as exc:
                    answer = f"Retrieval request failed: {exc}"
                    self.append_log("warn", "retrieval", answer)

            answer = answer or (f"Sophon retrieved {len(passages)} grounded passage(s) for '{query}'." if passages else f"No indexed passages were found for '{query}'.")
            self.state["lastRetrieval"] = {"query": query, "answer": answer, "passages": passages, "generatedAt": now()}; self.save(); return self.state
        if method == "record_blocked_egress_attempt":
            entry = {"id": rid("egress"), "attemptedTarget": str(params.get("target") or ""), "reason": str(params.get("reason") or "SOPHON_EGRESS_BLOCK_REQUIRED"), "blockedAt": now()}
            self.state["blockedEgressAttempts"] = [entry, *self.state["blockedEgressAttempts"]][:2000]; self.save(); return self.state
        if method == "export_logs_bundle":
            return "\n".join(json.dumps(entry, ensure_ascii=True) for entry in self.state["logs"])
        if method == "export_backup_json":
            return json.dumps({"exportedAt": now(), "module": "Sophon", "version": 1, "state": self.state}, ensure_ascii=True, indent=2)
        if method == "import_backup_json":
            raw = str(params.get("json") or ""); dry = bool(params.get("dryRun", False))
            payload = json.loads(raw); state = payload.get("state")
            if not isinstance(state, dict) or state.get("version") != 1: return {"ok": False, "message": "Backup payload failed schema validation."}
            if dry: return {"ok": True, "message": "Dry-run validation passed."}
            self.state = state; self.save(); return {"ok": True, "message": "Backup restored successfully."}
        raise ValueError(f"Unknown method: {method}")


def main() -> int:
    runtime = Runtime()
    while True:
        line = sys.stdin.readline()
        if line == "":
            break
        text = line.strip()
        if not text:
            continue
        req_id = None
        try:
            req = json.loads(text); req_id = req.get("id")
            method = str(req.get("method") or "").strip(); params = req.get("params") if isinstance(req.get("params"), dict) else {}
            result = runtime.handle(method, params)
            print(json.dumps({"id": req_id, "result": result}, ensure_ascii=True), flush=True)
            if method == "shutdown":
                break
        except Exception as exc:
            log.error("Runtime worker request failed: %s", exc)
            print(json.dumps({"id": req_id, "error": str(exc)}, ensure_ascii=True), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
