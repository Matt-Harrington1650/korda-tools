import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


WORKER_PATH = Path(__file__).resolve().parents[1] / "sophon_runtime_worker.py"
SPEC = importlib.util.spec_from_file_location("sophon_runtime_worker", WORKER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load runtime worker module from {WORKER_PATH}")
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

SUPPORTED_EXTENSIONS = [
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
LEGACY_INCLUDE = ["*.pdf", "*.docx", "*.md", "**/*.pdf", "**/*.docx", "**/*.md"]


class RuntimeEnumerationTests(unittest.TestCase):
    def _new_runtime(self, root: Path):
        state_dir = root / "state"
        state_dir.mkdir(parents=True, exist_ok=True)
        os.environ["SOPHON_APP_DATA_DIR"] = str(state_dir)
        return MODULE.Runtime()

    def _source(self, path: Path | str, source_type: str, include_patterns: list[str], allowed_extensions: list[str]):
        return {
            "sourceType": source_type,
            "path": str(path),
            "settings": {
                "includePatterns": include_patterns,
                "excludePatterns": [],
                "allowedExtensions": allowed_extensions,
                "maxFileSizeMb": 1024,
            },
        }

    def test_file_path_treated_as_file_even_when_source_type_folder(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            target = root / "one.md"
            target.write_text("# markdown", encoding="utf-8")
            runtime = self._new_runtime(root)
            files, diagnostics = runtime.enumerate_files(
                self._source(target, "folder", LEGACY_INCLUDE, SUPPORTED_EXTENSIONS)
            )
            self.assertEqual(1, len(files))
            self.assertTrue(files[0].endswith("one.md"))
            self.assertEqual("file", diagnostics["resolvedSourceMode"])
            self.assertEqual(1, diagnostics["candidateFileCount"])

    def test_direct_file_bypasses_include_patterns_and_uses_allowed_extensions(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            target = root / "sheet.pdf"
            target.write_text("pdf placeholder", encoding="utf-8")
            runtime = self._new_runtime(root)
            files, diagnostics = runtime.enumerate_files(
                self._source(target, "file", ["*.md"], [".pdf"])
            )
            self.assertEqual(1, len(files))
            self.assertEqual("file", diagnostics["resolvedSourceMode"])
            self.assertEqual(0, diagnostics["rejectedByInclude"])

    def test_legacy_include_auto_expands_for_missing_allowed_extensions(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            target = root / "drawing.DWG"
            target.write_text("dwg", encoding="utf-8")
            runtime = self._new_runtime(root)
            files, diagnostics = runtime.enumerate_files(
                self._source(root, "folder", LEGACY_INCLUDE, SUPPORTED_EXTENSIONS)
            )
            self.assertEqual(1, len(files))
            self.assertIn(".dwg", diagnostics["autoExpandedIncludeExtensions"])
            self.assertEqual(0, diagnostics["rejectedByInclude"])

    def test_all_supported_extensions_are_detected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            names = {
                ".pdf": "one.pdf",
                ".docx": "two.docx",
                ".md": "three.md",
                ".dwg": "drawing.DWG",
                ".dxf": "layout.DXF",
                ".ifc": "model.IFC",
                ".xlsx": "sheet.XLSX",
                ".csv": "data.csv",
                ".txt": "notes.TXT",
                ".jpg": "photo.JPG",
                ".png": "plan.PNG",
            }
            for filename in names.values():
                (root / filename).write_text(filename, encoding="utf-8")
            runtime = self._new_runtime(root)
            files, diagnostics = runtime.enumerate_files(
                self._source(root, "folder", LEGACY_INCLUDE, SUPPORTED_EXTENSIONS)
            )
            found = {Path(item).suffix.lower() for item in files}
            self.assertEqual(set(names.keys()), found)
            self.assertEqual(11, diagnostics["matchedFileCount"])

    def test_nested_uppercase_extensions_match_in_directory_mode(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            nested = root / "nested" / "deep"
            nested.mkdir(parents=True, exist_ok=True)
            (nested / "image.JPG").write_text("jpg", encoding="utf-8")
            (nested / "sample.csv").write_text("a,b\n1,2", encoding="utf-8")
            runtime = self._new_runtime(root)
            windows_style_path = str(root).replace("/", "\\")
            files, diagnostics = runtime.enumerate_files(
                self._source(windows_style_path, "folder", ["**/*"], [".jpg", ".csv"])
            )
            names = {Path(item).name for item in files}
            self.assertEqual({"image.JPG", "sample.csv"}, names)
            self.assertEqual("folder", diagnostics["resolvedSourceMode"])

    def test_unsupported_extension_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "ignore.exe").write_text("bad", encoding="utf-8")
            runtime = self._new_runtime(root)
            files, diagnostics = runtime.enumerate_files(
                self._source(root, "folder", ["**/*"], [".md"])
            )
            self.assertEqual([], files)
            self.assertEqual(1, diagnostics["rejectedByExtension"])
            self.assertEqual("extension_not_allowed", diagnostics["sampleRejections"][0]["reason"])

    def test_direct_file_with_unsupported_extension_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            target = root / "ignore.exe"
            target.write_text("bad", encoding="utf-8")
            runtime = self._new_runtime(root)
            files, diagnostics = runtime.enumerate_files(
                self._source(target, "file", ["**/*"], [".md"])
            )
            self.assertEqual([], files)
            self.assertEqual("file", diagnostics["resolvedSourceMode"])
            self.assertEqual(1, diagnostics["rejectedByExtension"])

    def test_queue_ingestion_no_match_failure_contains_actionable_diagnostics(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "ignore.exe").write_text("bad", encoding="utf-8")
            runtime = self._new_runtime(root)
            state = runtime.handle(
                "add_source",
                {
                    "name": "diag",
                    "sourceType": "folder",
                    "path": str(root),
                    "includePatterns": ["**/*"],
                    "allowedExtensions": [".md"],
                },
            )
            source_id = state["sources"][0]["id"]
            state = runtime.handle(
                "queue_ingestion",
                {"sourceId": source_id, "dryRun": False, "safeMode": True},
            )
            job = state["jobs"][0]
            self.assertEqual("failed", job["status"])
            self.assertIn("ResolvedSourceMode=folder", job["failureReason"])
            self.assertIn("RejectedByExtension=", job["failureReason"])
            self.assertIn("SampleRejections=[", job["failureReason"])
            self.assertIn("ignore.exe", job["failureReason"])


class RuntimeTempDirTests(unittest.TestCase):
    def test_temp_dir_falls_back_to_app_data_tmp_data_when_unset(self):
        with tempfile.TemporaryDirectory() as temp:
            app_data_dir = Path(temp) / "app-data"
            app_data_dir.mkdir(parents=True, exist_ok=True)
            with patch.dict(os.environ, {"SOPHON_APP_DATA_DIR": str(app_data_dir)}, clear=False):
                os.environ.pop("TEMP_DIR", None)
                os.environ.pop("TMPDIR", None)
                os.environ.pop("TMP", None)
                os.environ.pop("TEMP", None)
                resolved = MODULE.configure_runtime_temp_dir()
                expected = (app_data_dir / "tmp-data").resolve()
                self.assertEqual(expected, resolved.resolve())
                self.assertEqual(expected, Path(os.environ["TEMP_DIR"]).resolve())
                self.assertEqual(os.environ["TEMP_DIR"], os.environ["TMPDIR"])
                self.assertEqual(os.environ["TEMP_DIR"], os.environ["TMP"])
                self.assertEqual(os.environ["TEMP_DIR"], os.environ["TEMP"])

    def test_temp_dir_override_is_honored_and_created(self):
        with tempfile.TemporaryDirectory() as temp:
            override = Path(temp) / "explicit-temp-dir"
            with patch.dict(os.environ, {"TEMP_DIR": str(override)}, clear=False):
                os.environ.pop("TMPDIR", None)
                os.environ.pop("TMP", None)
                os.environ.pop("TEMP", None)
                resolved = MODULE.configure_runtime_temp_dir()
                self.assertEqual(override.resolve(), resolved.resolve())
                self.assertTrue(override.exists())
                self.assertEqual(os.environ["TEMP_DIR"], os.environ["TMPDIR"])
                self.assertEqual(os.environ["TEMP_DIR"], os.environ["TMP"])
                self.assertEqual(os.environ["TEMP_DIR"], os.environ["TEMP"])

    def test_temp_dir_for_app_data_stays_outside_repo_src_tauri_tmp_data(self):
        with tempfile.TemporaryDirectory() as temp:
            app_data_dir = Path(temp) / "korda-state"
            app_data_dir.mkdir(parents=True, exist_ok=True)
            repo_tmp = (WORKER_PATH.parents[2] / "tmp-data").resolve()
            with patch.dict(os.environ, {"SOPHON_APP_DATA_DIR": str(app_data_dir)}, clear=False):
                os.environ.pop("TEMP_DIR", None)
                os.environ.pop("TMPDIR", None)
                os.environ.pop("TMP", None)
                os.environ.pop("TEMP", None)
                resolved = MODULE.configure_runtime_temp_dir().resolve()
                self.assertNotEqual(repo_tmp, resolved)
                self.assertFalse(str(resolved).startswith(str(repo_tmp)))


class RuntimeRefreshJobsTests(unittest.TestCase):
    def _new_runtime(self, root: Path):
        state_dir = root / "state"
        state_dir.mkdir(parents=True, exist_ok=True)
        os.environ["SOPHON_APP_DATA_DIR"] = str(state_dir)
        return MODULE.Runtime()

    def _seed_running_job(self, runtime: MODULE.Runtime, started_at: str | None = None) -> dict:
        started = started_at or MODULE.now()
        job = {
            "id": "job-test",
            "sourceId": "source-test",
            "sourceName": "test",
            "status": "running",
            "currentStage": "extract",
            "stages": [
                {
                    "stage": stage,
                    "status": "running" if stage == "extract" else "queued",
                    "progressPct": 0,
                    "filesProcessed": 0,
                    "chunksProduced": 0,
                    "errorCount": 0,
                }
                for stage in MODULE.STAGES
            ],
            "checkpoints": [{"stage": "enumerate", "cursor": "task_id:task-1", "persistedAt": started}],
            "options": {"dryRun": False, "safeMode": False, "maxWorkers": 2},
            "startedAt": started,
            "retries": 0,
            "discoveredFiles": 1,
            "processedDocuments": 0,
            "failedDocuments": 0,
            "producedChunks": 0,
            "blockedByPolicy": False,
            "validation": {
                "integrityPass": True,
                "retrievalSanityPass": True,
                "orphanedChunks": 0,
                "missingMetadataRows": 0,
                "warnings": [],
                "errors": [],
            },
        }
        runtime.state["jobs"] = [job]
        runtime.task_for_job[job["id"]] = "task-1"
        return job

    def test_refresh_jobs_marks_finished_with_zero_success_as_failed(self):
        with tempfile.TemporaryDirectory() as temp:
            runtime = self._new_runtime(Path(temp))
            self._seed_running_job(runtime)

            class _Bridge:
                ingestor = object()
                rag = object()
                err = None
                ready = True

                def task(self, _task_id: str):
                    return {
                        "state": "FINISHED",
                        "result": {
                            "message": "Document upload job successfully completed.",
                            "documents_completed": 0,
                            "batches_completed": 0,
                            "failed_documents": [
                                {"document_name": "sample.pdf"},
                                {"document_name": "sample.docx"},
                            ],
                        },
                        "nv_ingest_status": {"document_wise_status": {"sample.pdf": "submitted", "sample.docx": "submitted"}},
                    }

                def docs(self):
                    return {"documents": [], "total_documents": 0}

            runtime.bridge = _Bridge()
            runtime.refresh_jobs()
            job = runtime.state["jobs"][0]
            self.assertEqual("failed", job["status"])
            self.assertEqual("extract", job["currentStage"])
            self.assertEqual(0, job["processedDocuments"])
            self.assertEqual(2, job["failedDocuments"])
            self.assertIn("Failed documents: sample.pdf, sample.docx.", job["failureReason"])
            self.assertNotIn(job["id"], runtime.task_for_job)

    def test_refresh_jobs_keeps_finished_with_success_as_completed(self):
        with tempfile.TemporaryDirectory() as temp:
            runtime = self._new_runtime(Path(temp))
            self._seed_running_job(runtime)

            class _Bridge:
                ingestor = object()
                rag = object()
                err = None
                ready = True

                def task(self, _task_id: str):
                    return {
                        "state": "FINISHED",
                        "result": {
                            "message": "ok",
                            "documents_completed": 1,
                            "batches_completed": 2,
                            "failed_documents": [],
                        },
                        "nv_ingest_status": {"document_wise_status": {"sample.md": "completed"}},
                    }

                def docs(self):
                    return {"documents": [{"document_info": {"chunk_count": 2}}], "total_documents": 1}

            runtime.bridge = _Bridge()
            runtime.refresh_jobs()
            job = runtime.state["jobs"][0]
            self.assertEqual("completed", job["status"])
            self.assertEqual("publish", job["currentStage"])
            self.assertEqual(1, job["processedDocuments"])
            self.assertEqual(0, job["failedDocuments"])
            self.assertEqual(2, job["producedChunks"])
            self.assertNotIn(job["id"], runtime.task_for_job)

    def test_refresh_jobs_marks_unknown_not_found_task_as_failed(self):
        with tempfile.TemporaryDirectory() as temp:
            runtime = self._new_runtime(Path(temp))
            self._seed_running_job(runtime)

            class _Bridge:
                ingestor = object()
                rag = object()
                err = None
                ready = True

                def task(self, _task_id: str):
                    return {
                        "state": "UNKNOWN",
                        "result": {
                            "message": "Task 'task-1' not found",
                            "documents_completed": 0,
                            "failed_documents": [],
                        },
                        "nv_ingest_status": {"document_wise_status": {}},
                    }

                def docs(self):
                    return {"documents": [], "total_documents": 0}

            runtime.bridge = _Bridge()
            runtime.refresh_jobs()
            job = runtime.state["jobs"][0]
            self.assertEqual("failed", job["status"])
            self.assertIn("Task 'task-1' not found", job["failureReason"])
            self.assertIn("re-queue ingestion", job["failureReason"])
            self.assertNotIn(job["id"], runtime.task_for_job)


class RuntimeQueueGuardTests(unittest.TestCase):
    def _new_runtime(self, root: Path):
        state_dir = root / "state"
        state_dir.mkdir(parents=True, exist_ok=True)
        os.environ["SOPHON_APP_DATA_DIR"] = str(state_dir)
        return MODULE.Runtime()

    def test_duplicate_active_job_for_same_source_is_ignored(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            sample = root / "one.md"
            sample.write_text("# one", encoding="utf-8")
            runtime = self._new_runtime(root)
            runtime.handle(
                "add_source",
                {
                    "name": "dup-guard-source",
                    "sourceType": "file",
                    "path": str(sample),
                    "includePatterns": ["*.md", "**/*.md"],
                    "allowedExtensions": [".md"],
                },
            )
            source_id = runtime.state["sources"][0]["id"]

            class _Bridge:
                ingestor = object()
                rag = object()
                err = None
                ready = True

                def ensure_collection(self):
                    return None

                def upload(self, files, chunk, overlap):
                    return {"task_id": "task-dup-1"}

                def task(self, _task_id):
                    return {
                        "state": "PENDING",
                        "result": {"documents_completed": 0, "failed_documents": []},
                        "nv_ingest_status": {"document_wise_status": {"one.md": "submitted"}},
                    }

                def docs(self):
                    return {"documents": [], "total_documents": 0}

            runtime.bridge = _Bridge()
            first = runtime.handle(
                "queue_ingestion",
                {"sourceId": source_id, "dryRun": False, "safeMode": False, "maxWorkers": 1},
            )
            self.assertEqual(1, len(first["jobs"]))
            self.assertEqual("running", first["jobs"][0]["status"])

            second = runtime.handle(
                "queue_ingestion",
                {"sourceId": source_id, "dryRun": False, "safeMode": False, "maxWorkers": 1},
            )
            self.assertEqual(1, len(second["jobs"]))
            self.assertIn("Duplicate queue request ignored", second["activity"][0])


class RuntimeRecoveryTests(unittest.TestCase):
    def test_restore_task_mapping_from_persisted_checkpoint(self):
        with tempfile.TemporaryDirectory() as temp:
            state_dir = Path(temp) / "state"
            state_dir.mkdir(parents=True, exist_ok=True)
            os.environ["SOPHON_APP_DATA_DIR"] = str(state_dir)
            payload = MODULE.state_template()
            payload["jobs"] = [
                {
                    "id": "job-restore-1",
                    "status": "running",
                    "currentStage": "extract",
                    "checkpoints": [{"stage": "enumerate", "cursor": "task_id:task-restore-1", "persistedAt": MODULE.now()}],
                    "stages": [
                        {"stage": stage, "status": "queued", "progressPct": 0, "filesProcessed": 0, "chunksProduced": 0, "errorCount": 0}
                        for stage in MODULE.STAGES
                    ],
                }
            ]
            (state_dir / "sophon_runtime_state.json").write_text(json.dumps(payload), encoding="utf-8")

            runtime = MODULE.Runtime()
            self.assertEqual("task-restore-1", runtime.task_for_job.get("job-restore-1"))

    def test_restore_marks_running_job_failed_when_task_reference_missing(self):
        with tempfile.TemporaryDirectory() as temp:
            state_dir = Path(temp) / "state"
            state_dir.mkdir(parents=True, exist_ok=True)
            os.environ["SOPHON_APP_DATA_DIR"] = str(state_dir)
            payload = MODULE.state_template()
            payload["jobs"] = [
                {
                    "id": "job-restore-missing",
                    "status": "running",
                    "currentStage": "extract",
                    "checkpoints": [],
                    "stages": [
                        {"stage": stage, "status": "queued", "progressPct": 0, "filesProcessed": 0, "chunksProduced": 0, "errorCount": 0}
                        for stage in MODULE.STAGES
                    ],
                }
            ]
            (state_dir / "sophon_runtime_state.json").write_text(json.dumps(payload), encoding="utf-8")

            runtime = MODULE.Runtime()
            job = runtime.state["jobs"][0]
            self.assertEqual("failed", job["status"])
            self.assertIn("Re-queue ingestion", job["failureReason"])


if __name__ == "__main__":
    unittest.main()
