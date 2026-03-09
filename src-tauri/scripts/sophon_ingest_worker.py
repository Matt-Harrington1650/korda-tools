from __future__ import annotations

import argparse
import hashlib
import json
import logging
import mimetypes
import os
import shutil
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

LOG = logging.getLogger("sophon.ingest.worker")
logging.basicConfig(level=os.environ.get("SOPHON_INGEST_LOG_LEVEL", "INFO").upper())

HEARTBEAT_SEC = float(os.environ.get("SOPHON_INGEST_HEARTBEAT_SEC", "5"))
POLL_SEC = float(os.environ.get("SOPHON_INGEST_POLL_SEC", "5"))
HTTP_TIMEOUT_SEC = int(os.environ.get("SOPHON_INGEST_HTTP_TIMEOUT_SEC", "30"))
LEASE_MS = 30_000
INTERRUPT_JOB_STATUSES = {"paused", "blocked", "cancelled", "stuck"}
TERMINAL_STAGE_STATUSES = {
    "blocked",
    "cancelled",
    "completed",
    "failed",
    "paused",
    "quarantined",
    "skipped",
    "split",
    "stuck",
}


def now_ms() -> int:
    return int(time.time() * 1000)


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"))


def json_loads(value: str | None) -> Any:
    if not value:
        return None
    return json.loads(value)


def http_get_json(url: str, timeout_sec: int = HTTP_TIMEOUT_SEC) -> Any:
    request = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(request, timeout=timeout_sec) as response:
        return json.loads(response.read().decode("utf-8"))


def http_post_json(url: str, payload: dict[str, Any], timeout_sec: int = HTTP_TIMEOUT_SEC) -> Any:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_sec) as response:
        return json.loads(response.read().decode("utf-8"))


def encode_multipart_form_data(
    fields: list[tuple[str, str]],
    files: list[tuple[str, Path]],
) -> tuple[str, bytes]:
    boundary = f"----sophon-ingest-{int(time.time() * 1000)}"
    lines: list[bytes] = []
    for key, value in fields:
        lines.append(f"--{boundary}".encode("utf-8"))
        lines.append(f'Content-Disposition: form-data; name="{key}"'.encode("utf-8"))
        lines.append(b"")
        lines.append(value.encode("utf-8"))

    for field_name, path in files:
        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        lines.append(f"--{boundary}".encode("utf-8"))
        lines.append(
            (
                f'Content-Disposition: form-data; name="{field_name}"; '
                f'filename="{path.name}"'
            ).encode("utf-8")
        )
        lines.append(f"Content-Type: {mime_type}".encode("utf-8"))
        lines.append(b"")
        lines.append(path.read_bytes())

    lines.append(f"--{boundary}--".encode("utf-8"))
    lines.append(b"")
    body = b"\r\n".join(lines)
    return f"multipart/form-data; boundary={boundary}", body


def http_post_multipart(
    url: str,
    *,
    fields: list[tuple[str, str]],
    files: list[tuple[str, Path]],
    timeout_sec: int = HTTP_TIMEOUT_SEC,
) -> Any:
    content_type, body = encode_multipart_form_data(fields, files)
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": content_type},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_sec) as response:
        return json.loads(response.read().decode("utf-8"))


def maybe_load_pdf_tools():
    try:
        from pypdf import PdfReader, PdfWriter  # type: ignore

        return PdfReader, PdfWriter
    except Exception:
        return None, None


@dataclass
class WorkerConfig:
    db_path: Path
    worker_id: str
    app_data_dir: Path
    ingestor_base_url: str
    rag_base_url: str


class IngestWorker:
    def __init__(self, config: WorkerConfig) -> None:
        self.config = config
        self.conn = sqlite3.connect(str(config.db_path))
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self._pdf_reader_cls, self._pdf_writer_cls = maybe_load_pdf_tools()
        self.ingest_root = config.app_data_dir / "ingest"
        self.ingest_root.mkdir(parents=True, exist_ok=True)

    def run(self) -> None:
        LOG.info("ingest worker starting db=%s worker_id=%s", self.config.db_path, self.config.worker_id)
        while True:
            try:
                job = self.claim_job()
                if job is None:
                    time.sleep(2)
                    continue
                try:
                    self.process_job(job)
                except Exception as exc:  # noqa: BLE001
                    job_id = str(job["job_id"])
                    self.set_job(
                        job_id,
                        status="failed",
                        stage="verification",
                        progress_pct=100.0,
                        detail_message=f"Worker exception: {exc}",
                        error_code="worker_exception",
                        error_message=str(exc),
                        ended=True,
                    )
                    self.insert_event(job_id, None, "error", "worker_exception", "verification", str(exc), None)
                    LOG.exception("job %s failed with worker exception", job_id)
            except KeyboardInterrupt:
                raise
            except Exception as exc:  # noqa: BLE001
                LOG.exception("ingest worker loop error: %s", exc)
                time.sleep(2)

    def claim_job(self) -> sqlite3.Row | None:
        now = now_ms()
        row = self.conn.execute(
            """
            SELECT job_id, status
            FROM ingest_jobs
            WHERE status = 'queued'
               OR (status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at < ?))
            ORDER BY
              CASE WHEN status = 'running' THEN 0 ELSE 1 END,
              created_at ASC
            LIMIT 1
            """,
            (now,),
        ).fetchone()
        if row is None:
            return None

        job_id = str(row["job_id"])
        prior_status = str(row["status"])
        cursor = self.conn.execute(
            """
            UPDATE ingest_jobs
            SET status = 'running',
                worker_id = ?2,
                lease_expires_at = ?3,
                started_at = COALESCE(started_at, ?1),
                updated_at = ?1,
                last_heartbeat_at = ?1,
                detail_message = 'Worker claimed job.'
            WHERE job_id = ?4
              AND (status = 'queued' OR (status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at < ?5)))
            """,
            (now, self.config.worker_id, now + LEASE_MS, job_id, now),
        )
        self.conn.commit()
        if cursor.rowcount != 1:
            return None

        self.insert_event(
            job_id,
            None,
            "info",
            "job_claimed" if prior_status == "queued" else "job_reclaimed",
            "queued",
            (
                f"Worker {self.config.worker_id} claimed job."
                if prior_status == "queued"
                else f"Worker {self.config.worker_id} reclaimed orphaned job lease."
            ),
            {"priorStatus": prior_status},
        )
        return self.get_job(job_id)

    def get_job(self, job_id: str) -> sqlite3.Row:
        row = self.conn.execute(
            """
            SELECT job_id, source_id, source_name, collection_name, status, current_stage, progress_pct,
                   checkpoint_json, source_snapshot_json, options_json, current_file_id
            FROM ingest_jobs
            WHERE job_id = ?
            """,
            (job_id,),
        ).fetchone()
        if row is None:
            raise RuntimeError(f"Job {job_id} no longer exists.")
        return row

    def get_next_file_row(self, job_id: str) -> sqlite3.Row | None:
        return self.conn.execute(
            """
            SELECT file_id, parent_file_id, source_path, staged_path, display_name, size_bytes, mime_type,
                   page_count, page_range_start, page_range_end, status, current_stage,
                   progress_pct, checkpoint_json, error_code, error_message
            FROM ingest_files
            WHERE job_id = ?
              AND status = 'queued'
            ORDER BY created_at ASC, display_name COLLATE NOCASE ASC
            LIMIT 1
            """,
            (job_id,),
        ).fetchone()

    def set_job(
        self,
        job_id: str,
        *,
        status: str | None = None,
        stage: str | None = None,
        progress_pct: float | None = None,
        detail_message: str | None = None,
        current_file_id: str | None = None,
        clear_current_file: bool = False,
        error_code: str | None = None,
        error_message: str | None = None,
        ended: bool = False,
    ) -> None:
        previous = self.conn.execute(
            "SELECT status, current_stage, progress_pct, detail_message FROM ingest_jobs WHERE job_id = ?",
            (job_id,),
        ).fetchone()
        if previous is None:
            raise RuntimeError(f"Job {job_id} no longer exists.")
        now = now_ms()
        columns = ["updated_at = ?", "last_heartbeat_at = ?", "lease_expires_at = ?"]
        values: list[Any] = [now, now, now + LEASE_MS]
        if status is not None:
            columns.append("status = ?")
            values.append(status)
        if stage is not None:
            columns.append("current_stage = ?")
            columns.append("stage_started_at = ?")
            values.extend([stage, now])
        if progress_pct is not None:
            columns.append("progress_pct = ?")
            values.append(progress_pct)
        if detail_message is not None:
            columns.append("detail_message = ?")
            values.append(detail_message)
        if current_file_id is not None:
            columns.append("current_file_id = ?")
            values.append(current_file_id)
        elif clear_current_file:
            columns.append("current_file_id = NULL")
        if error_code is not None:
            columns.append("error_code = ?")
            values.append(error_code)
        if error_message is not None:
            columns.append("error_message = ?")
            values.append(error_message)
        if ended:
            columns.append("ended_at = ?")
            values.append(now)
        values.append(job_id)
        self.conn.execute(
            f"UPDATE ingest_jobs SET {', '.join(columns)} WHERE job_id = ?",
            values,
        )
        self.conn.commit()
        resolved_status = status or str(previous["status"])
        resolved_stage = stage or str(previous["current_stage"])
        resolved_progress = float(progress_pct if progress_pct is not None else previous["progress_pct"])
        resolved_detail = detail_message if detail_message is not None else previous["detail_message"]
        self.sync_stage_run(
            job_id,
            None,
            resolved_stage,
            resolved_status,
            resolved_progress,
            resolved_detail,
            close_others=stage is not None and resolved_stage != str(previous["current_stage"]),
        )

    def set_file(
        self,
        file_id: str,
        *,
        status: str | None = None,
        stage: str | None = None,
        progress_pct: float | None = None,
        staged_path: str | None = None,
        page_count: int | None = None,
        page_range_start: int | None = None,
        page_range_end: int | None = None,
        checkpoint_json: Any = None,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> None:
        previous = self.conn.execute(
            "SELECT job_id, status, current_stage, progress_pct FROM ingest_files WHERE file_id = ?",
            (file_id,),
        ).fetchone()
        if previous is None:
            raise RuntimeError(f"File {file_id} no longer exists.")
        now = now_ms()
        columns = ["updated_at = ?", "last_heartbeat_at = ?"]
        values: list[Any] = [now, now]
        if status is not None:
            columns.append("status = ?")
            values.append(status)
        if stage is not None:
            columns.append("current_stage = ?")
            values.append(stage)
        if progress_pct is not None:
            columns.append("progress_pct = ?")
            values.append(progress_pct)
        if staged_path is not None:
            columns.append("staged_path = ?")
            values.append(staged_path)
        if page_count is not None:
            columns.append("page_count = ?")
            values.append(page_count)
        if page_range_start is not None:
            columns.append("page_range_start = ?")
            values.append(page_range_start)
        if page_range_end is not None:
            columns.append("page_range_end = ?")
            values.append(page_range_end)
        if checkpoint_json is not None:
            columns.append("checkpoint_json = ?")
            values.append(json_dumps(checkpoint_json) if checkpoint_json else None)
        if error_code is not None:
            columns.append("error_code = ?")
            values.append(error_code)
        if error_message is not None:
            columns.append("error_message = ?")
            values.append(error_message)
        values.append(file_id)
        self.conn.execute(
            f"UPDATE ingest_files SET {', '.join(columns)} WHERE file_id = ?",
            values,
        )
        self.conn.commit()
        resolved_status = status or str(previous["status"])
        resolved_stage = stage or str(previous["current_stage"])
        resolved_progress = float(progress_pct if progress_pct is not None else previous["progress_pct"])
        self.sync_stage_run(
            str(previous["job_id"]),
            file_id,
            resolved_stage,
            resolved_status,
            resolved_progress,
            error_message if error_message is not None else None,
            close_others=stage is not None and resolved_stage != str(previous["current_stage"]),
        )

    def sync_stage_run(
        self,
        job_id: str,
        file_id: str | None,
        stage: str,
        status: str,
        progress_pct: float,
        detail_message: str | None,
        *,
        close_others: bool,
    ) -> None:
        if not stage:
            return
        now = now_ms()
        if close_others:
            self.conn.execute(
                """
                UPDATE ingest_stage_runs
                SET status = CASE WHEN status = 'running' THEN 'completed' ELSE status END,
                    updated_at = ?1,
                    ended_at = COALESCE(ended_at, ?1),
                    heartbeat_at = ?1
                WHERE job_id = ?2
                  AND ((file_id = ?3) OR (file_id IS NULL AND ?3 IS NULL))
                  AND ended_at IS NULL
                  AND stage <> ?4
                """,
                (now, job_id, file_id, stage),
            )
        row = self.conn.execute(
            """
            SELECT run_id
            FROM ingest_stage_runs
            WHERE job_id = ?
              AND ((file_id = ?) OR (file_id IS NULL AND ? IS NULL))
              AND stage = ?
              AND ended_at IS NULL
            ORDER BY started_at DESC
            LIMIT 1
            """,
            (job_id, file_id, file_id, stage),
        ).fetchone()
        terminal = status in TERMINAL_STAGE_STATUSES
        ended_at = now if terminal else None
        if row is None:
            self.conn.execute(
                """
                INSERT INTO ingest_stage_runs (
                    run_id, job_id, file_id, stage, status, progress_pct,
                    detail_message, started_at, updated_at, ended_at, heartbeat_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"ingest-run-{os.urandom(8).hex()}",
                    job_id,
                    file_id,
                    stage,
                    status,
                    progress_pct,
                    detail_message,
                    now,
                    now,
                    ended_at,
                    now,
                ),
            )
        else:
            self.conn.execute(
                """
                UPDATE ingest_stage_runs
                SET status = ?2,
                    progress_pct = ?3,
                    detail_message = ?4,
                    updated_at = ?5,
                    heartbeat_at = ?5,
                    ended_at = CASE
                        WHEN ?6 = 1 THEN COALESCE(ended_at, ?5)
                        ELSE NULL
                    END
                WHERE run_id = ?1
                """,
                (
                    str(row["run_id"]),
                    status,
                    progress_pct,
                    detail_message,
                    now,
                    1 if terminal else 0,
                ),
            )
        self.conn.commit()

    def insert_event(
        self,
        job_id: str,
        file_id: str | None,
        level: str,
        kind: str,
        stage: str | None,
        message: str,
        payload: Any,
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO ingest_events (event_id, job_id, file_id, level, kind, stage, message, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"ingest-event-{os.urandom(8).hex()}",
                job_id,
                file_id,
                level,
                kind,
                stage,
                message,
                json_dumps(payload) if payload is not None else None,
                now_ms(),
            ),
        )
        self.conn.commit()

    def process_job(self, job: sqlite3.Row) -> None:
        job_id = str(job["job_id"])
        source_snapshot = json_loads(job["source_snapshot_json"]) or {}
        options = json_loads(job["options_json"]) or {}
        self.insert_event(job_id, None, "info", "job_started", "preflight", "Background ingestion started.", None)
        self.set_job(job_id, stage="preflight", progress_pct=0.0, detail_message="Running preflight checks.")
        self.ensure_collection(str(job["collection_name"]))

        completed = 0
        while True:
            current_job = self.get_job(job_id)
            if str(current_job["status"]) in INTERRUPT_JOB_STATUSES:
                self.insert_event(job_id, None, "warn", "job_interrupted", None, f"Job left running state: {current_job['status']}", None)
                return
            file_row = self.get_next_file_row(job_id)
            if file_row is None:
                break
            total_files = max(1, self.count_work_units(job_id))
            self.set_job(
                job_id,
                status="running",
                stage="hashing",
                progress_pct=round((completed / total_files) * 100.0, 2),
                detail_message=f"Preparing {file_row['display_name']}.",
                current_file_id=str(file_row["file_id"]),
            )
            result = self.process_file(job_id, file_row, str(job["collection_name"]), source_snapshot, options)
            if result == "completed":
                completed += 1
            elif result == "interrupted":
                return

        failed_count = int(
            self.conn.execute(
                "SELECT COUNT(*) FROM ingest_files WHERE job_id = ? AND status = 'failed'",
                (job_id,),
            ).fetchone()[0]
        )
        unfinished_count = int(
            self.conn.execute(
                """
                SELECT COUNT(*)
                FROM ingest_files
                WHERE job_id = ?
                  AND status NOT IN ('completed', 'failed', 'skipped', 'quarantined', 'split', 'cancelled')
                """,
                (job_id,),
            ).fetchone()[0]
        )
        if unfinished_count > 0:
            self.set_job(
                job_id,
                status="stuck",
                stage="verification",
                progress_pct=min(99.0, float(current_job["progress_pct"] or 0)),
                detail_message="Job has unfinished files but no runnable queue item.",
                error_code="unfinished_files",
                error_message="Job has unfinished files but no queued work item to process.",
            )
            self.insert_event(
                job_id,
                None,
                "error",
                "job_unfinished",
                "verification",
                "Job has unfinished files but no queued work item to process.",
                {"unfinishedFiles": unfinished_count, "failedFiles": failed_count},
            )
            return
        if failed_count > 0 and completed == 0:
            self.set_job(
                job_id,
                status="failed",
                stage="verification",
                progress_pct=100.0,
                detail_message="All files failed during ingestion.",
                error_code="job_failed",
                error_message="All files failed during ingestion.",
                ended=True,
            )
            self.insert_event(job_id, None, "error", "job_failed", "verification", "All files failed during ingestion.", None)
            return

        self.set_job(
            job_id,
            status="completed",
            stage="verification",
            progress_pct=100.0,
            detail_message=f"Completed {completed} file(s); failed {failed_count}.",
            clear_current_file=True,
            ended=True,
        )
        self.insert_event(
            job_id,
            None,
            "info",
            "job_completed",
            "verification",
            f"Completed {completed} file(s); failed {failed_count}.",
            {"completedFiles": completed, "failedFiles": failed_count},
        )

    def process_file(
        self,
        job_id: str,
        file_row: sqlite3.Row,
        collection_name: str,
        source_snapshot: dict[str, Any],
        options: dict[str, Any],
    ) -> str:
        file_id = str(file_row["file_id"])
        checkpoint = json_loads(file_row["checkpoint_json"]) or {}
        source_path = Path(str(file_row["source_path"]))
        if not source_path.exists():
            self.fail_file(job_id, file_id, "source_missing", f"Source file is missing: {source_path}")
            return "failed"

        staged_dir = self.ingest_root / job_id
        staged_dir.mkdir(parents=True, exist_ok=True)
        staged_path = Path(str(file_row["staged_path"])) if file_row["staged_path"] else staged_dir / source_path.name
        has_pre_staged_artifact = staged_path.exists()

        self.set_file(file_id, status="running", stage="hashing", progress_pct=5)
        file_hash = self.hash_file(staged_path if has_pre_staged_artifact else source_path)
        self.insert_event(job_id, file_id, "info", "hash_complete", "hashing", "File hash computed.", {"sha256": file_hash})

        self.set_job(job_id, stage="staging", detail_message=f"Staging {source_path.name}.", current_file_id=file_id)
        self.set_file(file_id, status="running", stage="staging", progress_pct=12)
        if not has_pre_staged_artifact:
            shutil.copy2(source_path, staged_path)
        checkpoint.update({"sha256": file_hash, "stagedPath": str(staged_path)})
        self.set_file(file_id, staged_path=str(staged_path), checkpoint_json=checkpoint)

        page_count = int(file_row["page_count"]) if file_row["page_count"] is not None else self.maybe_get_pdf_page_count(staged_path)
        if page_count is not None:
            self.set_file(file_id, page_count=page_count)
        if (
            file_row["parent_file_id"] is None
            and file_row["page_range_start"] is None
            and file_row["page_range_end"] is None
            and self.maybe_materialize_pdf_shards(job_id, file_row, source_snapshot, staged_path, page_count, checkpoint)
        ):
            return "delegated"
        page_range_start = int(file_row["page_range_start"]) if file_row["page_range_start"] is not None else None
        page_range_end = int(file_row["page_range_end"]) if file_row["page_range_end"] is not None else None
        if page_range_start is None or page_range_end is None:
            page_range_start, page_range_end = self.default_page_window(staged_path, source_snapshot, page_count)
        if page_range_start is not None and page_range_end is not None:
            self.set_file(file_id, page_range_start=page_range_start, page_range_end=page_range_end)
            checkpoint["pageRange"] = [page_range_start, page_range_end]
            self.set_file(file_id, checkpoint_json=checkpoint)

        task_id = str(checkpoint.get("taskId") or "").strip()
        resuming_task = bool(task_id) and str(file_row["current_stage"] or "") in {"extract_dispatch", "extract_running"}
        if resuming_task:
            resumed_progress = max(20.0, float(file_row["progress_pct"] or 0))
            self.set_job(job_id, stage="extract_running", progress_pct=resumed_progress, detail_message=f"Resuming {source_path.name}.", current_file_id=file_id)
            self.set_file(
                file_id,
                status="running",
                stage="extract_running",
                progress_pct=resumed_progress,
                checkpoint_json={**checkpoint, "state": "resuming"},
            )
            self.insert_event(job_id, file_id, "info", "task_resumed", "extract_running", f"Resuming task {task_id}.", {"taskId": task_id})
        else:
            self.set_job(job_id, stage="extract_dispatch", detail_message=f"Submitting {source_path.name} to ingestor.")
            self.set_file(file_id, status="running", stage="extract_dispatch", progress_pct=20, checkpoint_json=checkpoint)
            task_id = self.submit_file(
                staged_path,
                str(source_snapshot.get("settings", {}).get("chunkSize", 1024)),
                str(source_snapshot.get("settings", {}).get("chunkOverlap", 150)),
                collection_name,
                str(source_snapshot.get("sourceName") or source_snapshot.get("source_name") or "source"),
                str(job_id),
            )
            checkpoint["taskId"] = task_id
            self.set_file(file_id, checkpoint_json=checkpoint)
            self.insert_event(job_id, file_id, "info", "task_submitted", "extract_dispatch", f"Submitted task {task_id}.", {"taskId": task_id})

        result = self.poll_task(job_id, file_id, task_id, staged_path, checkpoint)
        if result["errorCode"] == "interrupted":
            return "interrupted"
        if not result["ok"]:
            self.fail_file(job_id, file_id, result["errorCode"], result["message"])
            return "failed"

        self.set_job(job_id, stage="extract_postprocess", detail_message=f"Verifying {source_path.name}.")
        self.set_file(file_id, status="completed", stage="verification", progress_pct=100, checkpoint_json={**checkpoint, "result": result["payload"]})
        self.insert_event(job_id, file_id, "info", "file_completed", "verification", f"Completed {source_path.name}.", result["payload"])
        return "completed"

    def fail_file(self, job_id: str, file_id: str, error_code: str, message: str) -> None:
        self.set_file(
            file_id,
            status="failed",
            stage="verification",
            progress_pct=100,
            error_code=error_code,
            error_message=message,
        )
        self.insert_event(job_id, file_id, "error", "file_failed", "verification", message, {"errorCode": error_code})

    def hash_file(self, path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def maybe_get_pdf_page_count(self, path: Path) -> int | None:
        if path.suffix.lower() != ".pdf" or self._pdf_reader_cls is None:
            return None
        try:
            reader = self._pdf_reader_cls(str(path))
            return len(reader.pages)
        except Exception as exc:  # noqa: BLE001
            LOG.warning("Unable to read PDF page count for %s: %s", path, exc)
            return None

    def default_page_window(
        self,
        path: Path,
        source_snapshot: dict[str, Any],
        page_count: int | None,
    ) -> tuple[int | None, int | None]:
        window_size = self.determine_page_window_size(path, source_snapshot, page_count)
        if window_size is None or page_count is None:
            return None, None
        return 1, min(page_count, window_size)

    def determine_page_window_size(
        self,
        path: Path,
        source_snapshot: dict[str, Any],
        page_count: int | None,
    ) -> int | None:
        if path.suffix.lower() != ".pdf" or page_count is None:
            return None
        settings = source_snapshot.get("settings", {})
        ocr_enabled = bool(settings.get("ocrEnabled", True))
        size_bytes = path.stat().st_size
        if page_count <= 250:
            return page_count
        if page_count <= 1000 and not (ocr_enabled and size_bytes / max(page_count, 1) > 500_000):
            return 100
        return 50

    def maybe_materialize_pdf_shards(
        self,
        job_id: str,
        file_row: sqlite3.Row,
        source_snapshot: dict[str, Any],
        staged_path: Path,
        page_count: int | None,
        checkpoint: dict[str, Any],
    ) -> bool:
        window_size = self.determine_page_window_size(staged_path, source_snapshot, page_count)
        if window_size is None or page_count is None or page_count <= window_size:
            return False
        if self._pdf_reader_cls is None or self._pdf_writer_cls is None:
            self.insert_event(
                job_id,
                str(file_row["file_id"]),
                "warn",
                "split_unavailable",
                "staging",
                "Large PDF will run as a single task because pypdf is unavailable.",
                {"pageCount": page_count},
            )
            return False

        file_id = str(file_row["file_id"])
        existing_children = list(
            self.conn.execute(
                """
                SELECT file_id
                FROM ingest_files
                WHERE parent_file_id = ?
                ORDER BY created_at ASC
                """,
                (file_id,),
            ).fetchall()
        )
        if existing_children:
            checkpoint["splitChildren"] = [str(row["file_id"]) for row in existing_children]
            self.set_file(file_id, status="split", stage="staging", progress_pct=100, checkpoint_json=checkpoint)
            return True

        reader = self._pdf_reader_cls(str(staged_path))
        shard_dir = staged_path.parent / "shards"
        shard_dir.mkdir(parents=True, exist_ok=True)
        created_at = now_ms()
        child_ids: list[str] = []
        for start in range(0, page_count, window_size):
            end = min(page_count, start + window_size)
            child_id = f"ingest-file-{os.urandom(8).hex()}"
            child_ids.append(child_id)
            shard_path = shard_dir / f"{staged_path.stem}_p{start + 1:04d}-{end:04d}{staged_path.suffix.lower()}"
            writer = self._pdf_writer_cls()
            for page_index in range(start, end):
                writer.add_page(reader.pages[page_index])
            with shard_path.open("wb") as handle:
                writer.write(handle)
            child_checkpoint = {
                "parentFileId": file_id,
                "stagedPath": str(shard_path),
                "sourcePath": str(file_row["source_path"]),
                "pageRange": [start + 1, end],
                "fullDocumentPath": str(staged_path),
            }
            self.conn.execute(
                """
                INSERT INTO ingest_files (
                    file_id, job_id, parent_file_id, source_path, staged_path, display_name, size_bytes,
                    mime_type, page_count, page_range_start, page_range_end, status, current_stage,
                    progress_pct, last_heartbeat_at, checkpoint_json, error_code, error_message,
                    created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 'queued',
                    0, NULL, ?, NULL, NULL,
                    ?, ?
                )
                """,
                (
                    child_id,
                    job_id,
                    file_id,
                    str(file_row["source_path"]),
                    str(shard_path),
                    f"{Path(str(file_row['display_name'])).name} [{start + 1}-{end}]",
                    shard_path.stat().st_size,
                    "application/pdf",
                    end - start,
                    start + 1,
                    end,
                    json_dumps(child_checkpoint),
                    created_at,
                    created_at,
                ),
            )
        self.conn.commit()
        checkpoint["splitChildren"] = child_ids
        checkpoint["pageWindowSize"] = window_size
        self.set_file(
            file_id,
            status="split",
            stage="staging",
            progress_pct=100,
            page_count=page_count,
            checkpoint_json=checkpoint,
        )
        self.insert_event(
            job_id,
            file_id,
            "info",
            "file_split",
            "staging",
            f"Split large PDF into {len(child_ids)} durable work units.",
            {"pageCount": page_count, "windowSize": window_size, "childFileIds": child_ids},
        )
        return True

    def count_work_units(self, job_id: str) -> int:
        return int(
            self.conn.execute(
                """
                SELECT COUNT(*)
                FROM ingest_files
                WHERE job_id = ?
                  AND status <> 'split'
                """,
                (job_id,),
            ).fetchone()[0]
        )

    def ensure_collection(self, collection_name: str) -> None:
        try:
            payload = http_get_json(f"{self.config.ingestor_base_url}/collections")
            names = {
                str(item.get("collection_name") or "").strip()
                for item in (payload.get("collections") or [])
            }
            if collection_name in names:
                return
        except Exception as exc:  # noqa: BLE001
            LOG.warning("collections lookup failed: %s", exc)

        http_post_json(
            f"{self.config.ingestor_base_url}/collection",
            {"collection_name": collection_name},
        )

    def submit_file(
        self,
        staged_path: Path,
        chunk_size: str,
        chunk_overlap: str,
        collection_name: str,
        source_name: str,
        job_id: str,
    ) -> str:
        payload = {
            "collection_name": collection_name,
            "blocking": False,
            "split_options": {
                "chunk_size": int(chunk_size),
                "chunk_overlap": int(chunk_overlap),
            },
            "generate_summary": False,
            "documents_catalog_metadata": [
                {"filename": staged_path.name, "description": f"SOPHON ingest {source_name}", "tags": ["sophon", job_id]}
            ],
            "summary_options": None,
            "enable_pdf_split_processing": False,
            "pdf_split_processing_options": {"pages_per_chunk": 100},
        }
        response = http_post_multipart(
            f"{self.config.ingestor_base_url}/documents",
            fields=[("data", json_dumps(payload))],
            files=[("documents", staged_path)],
        )
        task_id = str(response.get("task_id") or "").strip()
        if not task_id:
            raise RuntimeError(f"ingestor did not return task_id: {response}")
        return task_id

    def poll_task(
        self,
        job_id: str,
        file_id: str,
        task_id: str,
        staged_path: Path,
        checkpoint: dict[str, Any],
    ) -> dict[str, Any]:
        while True:
            current_job = self.get_job(job_id)
            if str(current_job["status"]) in INTERRUPT_JOB_STATUSES:
                job_status = str(current_job["status"])
                self.set_file(
                    file_id,
                    status=job_status,
                    stage="extract_running",
                    checkpoint_json={**checkpoint, "taskId": task_id, "state": job_status},
                )
                self.insert_event(job_id, file_id, "warn", "task_poll_interrupted", "extract_running", f"Stopped polling task {task_id} because job status is {current_job['status']}.", {"taskId": task_id})
                return {"ok": False, "errorCode": "interrupted", "message": f"Job status is {current_job['status']}", "payload": None}

            try:
                payload = http_get_json(
                    f"{self.config.ingestor_base_url}/status?{urllib.parse.urlencode({'task_id': task_id})}"
                )
            except urllib.error.HTTPError as exc:
                return {"ok": False, "errorCode": "status_http_error", "message": str(exc), "payload": None}
            except Exception as exc:  # noqa: BLE001
                return {"ok": False, "errorCode": "status_error", "message": str(exc), "payload": None}

            state = str(payload.get("state") or "UNKNOWN").upper()
            nv_status = payload.get("nv_ingest_status") or {}
            progress = 30.0
            if isinstance(nv_status, dict):
                extracted = int(nv_status.get("extraction_completed") or 0)
                progress = min(85.0, 30.0 + extracted * 10.0)
            detail = f"Task {task_id} state={state} file={staged_path.name}"
            self.set_job(job_id, stage="extract_running", progress_pct=progress, detail_message=detail, current_file_id=file_id)
            self.set_file(file_id, status="running", stage="extract_running", progress_pct=progress, checkpoint_json={**checkpoint, "taskId": task_id, "lastStatus": payload})
            time.sleep(POLL_SEC)

            if state == "PENDING":
                continue
            if state == "FINISHED":
                return {"ok": True, "payload": payload}
            result = payload.get("result") or {}
            return {
                "ok": False,
                "errorCode": "ingestor_failed",
                "message": str(result.get("message") or f"Task ended with state={state}"),
                "payload": payload,
            }


def parse_args() -> WorkerConfig:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", required=True)
    parser.add_argument("--worker-id", required=True)
    parser.add_argument("--app-data-dir", required=True)
    parser.add_argument("--ingestor-base-url", required=True)
    parser.add_argument("--rag-base-url", required=True)
    args = parser.parse_args()
    return WorkerConfig(
        db_path=Path(args.db_path),
        worker_id=str(args.worker_id),
        app_data_dir=Path(args.app_data_dir),
        ingestor_base_url=str(args.ingestor_base_url).rstrip("/"),
        rag_base_url=str(args.rag_base_url).rstrip("/"),
    )


def main() -> int:
    config = parse_args()
    worker = IngestWorker(config)
    worker.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
