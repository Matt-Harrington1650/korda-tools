import importlib.util
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path


WORKER_PATH = Path(__file__).resolve().parents[1] / "sophon_ingest_worker.py"
MIGRATIONS_DIR = WORKER_PATH.parents[1] / "migrations"
SPEC = importlib.util.spec_from_file_location("sophon_ingest_worker", WORKER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load ingest worker module from {WORKER_PATH}")
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def apply_ingest_migrations(db_path: Path) -> None:
    connection = sqlite3.connect(str(db_path))
    try:
        connection.executescript((MIGRATIONS_DIR / "0021_create_ingest_supervisor.sql").read_text(encoding="utf-8"))
        connection.executescript((MIGRATIONS_DIR / "0022_reconcile_ingest_supervisor_schema.sql").read_text(encoding="utf-8"))
        connection.commit()
    finally:
        connection.close()


class _FakeReader:
    def __init__(self, _path: str):
        self.pages = [object() for _ in range(833)]


class _FakeWriter:
    def __init__(self):
        self._page_count = 0

    def add_page(self, _page: object) -> None:
        self._page_count += 1

    def write(self, handle) -> None:
        handle.write(f"pages={self._page_count}".encode("utf-8"))


class IngestWorkerTests(unittest.TestCase):
    def _new_worker(self, root: Path) -> MODULE.IngestWorker:
        db_path = root / "korda_tools.db"
        apply_ingest_migrations(db_path)
        app_data_dir = root / "app-data"
        app_data_dir.mkdir(parents=True, exist_ok=True)
        config = MODULE.WorkerConfig(
            db_path=db_path,
            worker_id="worker-test",
            app_data_dir=app_data_dir,
            ingestor_base_url="http://localhost:8082/v1",
            rag_base_url="http://localhost:8081/v1",
        )
        return MODULE.IngestWorker(config)

    def _seed_job(self, worker: MODULE.IngestWorker, *, status: str = "queued", lease_expires_at: int | None = None) -> None:
        now = MODULE.now_ms()
        worker.conn.execute(
            """
            INSERT INTO ingest_jobs (
                job_id, source_id, source_name, collection_name, status, current_stage, progress_pct,
                created_at, started_at, updated_at, ended_at, last_heartbeat_at, stage_started_at,
                worker_id, lease_expires_at, retry_count, error_code, error_message,
                checkpoint_json, detail_message, current_file_id, source_snapshot_json, options_json
            ) VALUES (
                'job-1', 'source-1', 'Atlas', 'atlas', ?, 'queued', 0,
                ?, NULL, ?, NULL, NULL, ?,
                NULL, ?, 0, NULL, NULL,
                NULL, 'queued', NULL, '{}', '{}'
            )
            """,
            (status, now, now, now, lease_expires_at),
        )
        worker.conn.commit()

    def test_claim_job_reclaims_expired_running_lease(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            worker = self._new_worker(Path(temp))
            try:
                self._seed_job(worker, status="running", lease_expires_at=MODULE.now_ms() - 1_000)

                claimed = worker.claim_job()

                self.assertIsNotNone(claimed)
                row = worker.conn.execute(
                    "SELECT status, worker_id, lease_expires_at FROM ingest_jobs WHERE job_id = 'job-1'"
                ).fetchone()
                self.assertEqual("running", row["status"])
                self.assertEqual("worker-test", row["worker_id"])
                self.assertGreater(int(row["lease_expires_at"]), MODULE.now_ms())
            finally:
                worker.conn.close()

    def test_large_pdf_creates_child_shards_and_marks_parent_split(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            worker = self._new_worker(root)
            try:
                worker._pdf_reader_cls = _FakeReader
                worker._pdf_writer_cls = _FakeWriter
                now = MODULE.now_ms()
                staged_dir = root / "staged"
                staged_dir.mkdir(parents=True, exist_ok=True)
                staged_path = staged_dir / "atlas.pdf"
                staged_path.write_bytes(b"%PDF-1.4 fake")

                worker.conn.execute(
                    """
                    INSERT INTO ingest_jobs (
                        job_id, source_id, source_name, collection_name, status, current_stage, progress_pct,
                        created_at, started_at, updated_at, ended_at, last_heartbeat_at, stage_started_at,
                        worker_id, lease_expires_at, retry_count, error_code, error_message,
                        checkpoint_json, detail_message, current_file_id, source_snapshot_json, options_json
                    ) VALUES (
                        'job-1', 'source-1', 'Atlas', 'atlas', 'running', 'staging', 0,
                        ?, ?, ?, NULL, ?, ?, 'worker-test', ?, 0, NULL, NULL,
                        NULL, 'staging', NULL, '{}', '{}'
                    )
                    """,
                    (now, now, now, now, now, now + 30_000),
                )
                worker.conn.execute(
                    """
                    INSERT INTO ingest_files (
                        file_id, job_id, parent_file_id, source_path, staged_path, display_name, size_bytes,
                        mime_type, page_count, page_range_start, page_range_end, status, current_stage,
                        progress_pct, last_heartbeat_at, checkpoint_json, error_code, error_message,
                        created_at, updated_at
                    ) VALUES (
                        'file-parent', 'job-1', NULL, ?, ?, 'atlas.pdf', ?, 'application/pdf',
                        833, NULL, NULL, 'queued', 'queued', 0, NULL, NULL, NULL, NULL, ?, ?
                    )
                    """,
                    (str(staged_path), str(staged_path), staged_path.stat().st_size, now, now),
                )
                worker.conn.commit()

                file_row = worker.conn.execute(
                    "SELECT * FROM ingest_files WHERE file_id = 'file-parent'"
                ).fetchone()

                created = worker.maybe_materialize_pdf_shards(
                    "job-1",
                    file_row,
                    {"settings": {"ocrEnabled": True}},
                    staged_path,
                    833,
                    {},
                )

                self.assertTrue(created)
                parent = worker.conn.execute(
                    "SELECT status, checkpoint_json FROM ingest_files WHERE file_id = 'file-parent'"
                ).fetchone()
                children = worker.conn.execute(
                    """
                    SELECT file_id, page_range_start, page_range_end, status
                    FROM ingest_files
                    WHERE parent_file_id = 'file-parent'
                    ORDER BY page_range_start ASC
                    """
                ).fetchall()
                self.assertEqual("split", parent["status"])
                self.assertEqual(9, len(children))
                self.assertEqual((1, 100, "queued"), (children[0]["page_range_start"], children[0]["page_range_end"], children[0]["status"]))
                self.assertEqual((801, 833, "queued"), (children[-1]["page_range_start"], children[-1]["page_range_end"], children[-1]["status"]))
                self.assertEqual(9, worker.count_work_units("job-1"))
            finally:
                worker.conn.close()

    def test_process_file_resumes_existing_task_instead_of_resubmitting(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            worker = self._new_worker(root)
            try:
                now = MODULE.now_ms()
                source_dir = root / "source"
                source_dir.mkdir(parents=True, exist_ok=True)
                source_path = source_dir / "notes.txt"
                source_path.write_text("hello world", encoding="utf-8")

                staged_dir = root / "app-data" / "ingest" / "job-1"
                staged_dir.mkdir(parents=True, exist_ok=True)
                staged_path = staged_dir / "notes.txt"
                staged_path.write_text("hello world", encoding="utf-8")

                worker.conn.execute(
                    """
                    INSERT INTO ingest_jobs (
                        job_id, source_id, source_name, collection_name, status, current_stage, progress_pct,
                        created_at, started_at, updated_at, ended_at, last_heartbeat_at, stage_started_at,
                        worker_id, lease_expires_at, retry_count, error_code, error_message,
                        checkpoint_json, detail_message, current_file_id, source_snapshot_json, options_json
                    ) VALUES (
                        'job-1', 'source-1', 'Atlas', 'atlas', 'running', 'extract_running', 30,
                        ?, ?, ?, NULL, ?, ?, 'worker-test', ?, 0, NULL, NULL,
                        NULL, 'extracting', 'file-1', '{}', '{}'
                    )
                    """,
                    (now, now, now, now, now, now + 30_000),
                )
                worker.conn.execute(
                    """
                    INSERT INTO ingest_files (
                        file_id, job_id, parent_file_id, source_path, staged_path, display_name, size_bytes,
                        mime_type, page_count, page_range_start, page_range_end, status, current_stage,
                        progress_pct, last_heartbeat_at, checkpoint_json, error_code, error_message,
                        created_at, updated_at
                    ) VALUES (
                        'file-1', 'job-1', NULL, ?, ?, 'notes.txt', ?, 'text/plain',
                        NULL, NULL, NULL, 'queued', 'extract_running', 30, ?, ?, NULL, NULL, ?, ?
                    )
                    """,
                    (
                        str(source_path),
                        str(staged_path),
                        staged_path.stat().st_size,
                        now,
                        MODULE.json_dumps({"taskId": "task-123", "stagedPath": str(staged_path)}),
                        now,
                        now,
                    ),
                )
                worker.conn.commit()

                file_row = worker.conn.execute("SELECT * FROM ingest_files WHERE file_id = 'file-1'").fetchone()
                submitted = {"called": False}

                def fail_submit(*_args, **_kwargs):
                    submitted["called"] = True
                    raise AssertionError("submit_file should not be called when a task checkpoint already exists")

                worker.submit_file = fail_submit
                worker.poll_task = lambda job_id, file_id, task_id, staged_path, checkpoint: {
                    "ok": True,
                    "errorCode": None,
                    "message": None,
                    "payload": {"state": "FINISHED", "taskId": task_id},
                }

                result = worker.process_file("job-1", file_row, "atlas", {}, {})

                self.assertEqual("completed", result)
                self.assertFalse(submitted["called"])
                event = worker.conn.execute(
                    "SELECT kind, message FROM ingest_events WHERE job_id = 'job-1' ORDER BY created_at DESC LIMIT 1"
                ).fetchone()
                self.assertEqual("file_completed", event["kind"])
            finally:
                worker.conn.close()

    def test_process_job_marks_unfinished_blocked_files_as_stuck(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            worker = self._new_worker(root)
            try:
                now = MODULE.now_ms()
                worker.conn.execute(
                    """
                    INSERT INTO ingest_jobs (
                        job_id, source_id, source_name, collection_name, status, current_stage, progress_pct,
                        created_at, started_at, updated_at, ended_at, last_heartbeat_at, stage_started_at,
                        worker_id, lease_expires_at, retry_count, error_code, error_message,
                        checkpoint_json, detail_message, current_file_id, source_snapshot_json, options_json
                    ) VALUES (
                        'job-1', 'source-1', 'Atlas', 'atlas', 'running', 'extract_running', 30,
                        ?, ?, ?, NULL, ?, ?, 'worker-test', ?, 0, NULL, NULL,
                        NULL, 'extracting', NULL, '{}', '{}'
                    )
                    """,
                    (now, now, now, now, now, now + 30_000),
                )
                worker.conn.execute(
                    """
                    INSERT INTO ingest_files (
                        file_id, job_id, parent_file_id, source_path, staged_path, display_name, size_bytes,
                        mime_type, page_count, page_range_start, page_range_end, status, current_stage,
                        progress_pct, last_heartbeat_at, checkpoint_json, error_code, error_message,
                        created_at, updated_at
                    ) VALUES (
                        'file-1', 'job-1', NULL, 'C:\\temp\\missing.pdf', NULL, 'missing.pdf', 0, 'application/pdf',
                        NULL, NULL, NULL, 'blocked', 'extract_running', 30, ?, '{}', NULL, NULL, ?, ?
                    )
                    """,
                    (now, now, now),
                )
                worker.conn.commit()

                worker.ensure_collection = lambda _collection_name: None

                job = worker.get_job("job-1")
                worker.process_job(job)

                row = worker.conn.execute(
                    "SELECT status, error_code, error_message FROM ingest_jobs WHERE job_id = 'job-1'"
                ).fetchone()
                self.assertEqual("stuck", row["status"])
                self.assertEqual("unfinished_files", row["error_code"])
            finally:
                worker.conn.close()


if __name__ == "__main__":
    unittest.main()
