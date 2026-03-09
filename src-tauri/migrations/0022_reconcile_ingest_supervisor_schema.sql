PRAGMA foreign_keys = OFF;

ALTER TABLE ingest_jobs RENAME TO ingest_jobs_legacy;
ALTER TABLE ingest_files RENAME TO ingest_files_legacy;
ALTER TABLE ingest_stage_runs RENAME TO ingest_stage_runs_legacy;
ALTER TABLE ingest_events RENAME TO ingest_events_legacy;
ALTER TABLE ingest_alerts RENAME TO ingest_alerts_legacy;

CREATE TABLE ingest_jobs (
  job_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  status TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  progress_pct REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  updated_at INTEGER NOT NULL,
  ended_at INTEGER,
  last_heartbeat_at INTEGER,
  stage_started_at INTEGER,
  worker_id TEXT,
  lease_expires_at INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  checkpoint_json TEXT,
  detail_message TEXT,
  current_file_id TEXT,
  source_snapshot_json TEXT NOT NULL,
  options_json TEXT NOT NULL
);

CREATE TABLE ingest_files (
  file_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  parent_file_id TEXT,
  source_path TEXT NOT NULL,
  staged_path TEXT,
  display_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  page_count INTEGER,
  page_range_start INTEGER,
  page_range_end INTEGER,
  status TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  progress_pct REAL NOT NULL DEFAULT 0,
  last_heartbeat_at INTEGER,
  checkpoint_json TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES ingest_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (parent_file_id) REFERENCES ingest_files(file_id) ON DELETE SET NULL
);

CREATE TABLE ingest_stage_runs (
  run_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  file_id TEXT,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_pct REAL NOT NULL DEFAULT 0,
  detail_message TEXT,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ended_at INTEGER,
  heartbeat_at INTEGER,
  FOREIGN KEY (job_id) REFERENCES ingest_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES ingest_files(file_id) ON DELETE CASCADE
);

CREATE TABLE ingest_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  file_id TEXT,
  level TEXT NOT NULL,
  kind TEXT NOT NULL,
  stage TEXT,
  message TEXT NOT NULL,
  payload_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES ingest_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES ingest_files(file_id) ON DELETE CASCADE
);

CREATE TABLE ingest_alerts (
  alert_id TEXT PRIMARY KEY,
  job_id TEXT,
  file_id TEXT,
  severity TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  acknowledged_at INTEGER,
  FOREIGN KEY (job_id) REFERENCES ingest_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES ingest_files(file_id) ON DELETE CASCADE
);

INSERT INTO ingest_jobs (
  job_id, source_id, source_name, collection_name, status, current_stage, progress_pct,
  created_at, started_at, updated_at, ended_at, last_heartbeat_at, stage_started_at,
  worker_id, lease_expires_at, retry_count, error_code, error_message,
  checkpoint_json, detail_message, current_file_id, source_snapshot_json, options_json
)
SELECT
  job_id, source_id, source_name, collection_name, status, current_stage, progress_pct,
  created_at, started_at, updated_at, ended_at, last_heartbeat_at, stage_started_at,
  worker_id, lease_expires_at, retry_count, error_code, error_message,
  checkpoint_json, detail_message, current_file_id, source_snapshot_json, options_json
FROM ingest_jobs_legacy;

INSERT INTO ingest_files (
  file_id, job_id, parent_file_id, source_path, staged_path, display_name, size_bytes,
  mime_type, page_count, page_range_start, page_range_end, status, current_stage,
  progress_pct, last_heartbeat_at, checkpoint_json, error_code, error_message,
  created_at, updated_at
)
SELECT
  file_id, job_id, parent_file_id, source_path, staged_path, display_name, size_bytes,
  mime_type, page_count, page_range_start, page_range_end, status, current_stage,
  progress_pct, last_heartbeat_at, checkpoint_json, error_code, error_message,
  created_at, updated_at
FROM ingest_files_legacy;

INSERT INTO ingest_stage_runs (
  run_id, job_id, file_id, stage, status, progress_pct, detail_message, started_at, updated_at, ended_at, heartbeat_at
)
SELECT
  id, job_id, file_id, stage, status, progress_pct, detail_message, started_at, updated_at, ended_at, heartbeat_at
FROM ingest_stage_runs_legacy;

INSERT INTO ingest_events (
  event_id, job_id, file_id, level, kind, stage, message, payload_json, created_at
)
SELECT
  id, job_id, file_id, severity, event_type, NULL, message, payload_json, created_at
FROM ingest_events_legacy
WHERE job_id IS NOT NULL;

INSERT INTO ingest_alerts (
  alert_id, job_id, file_id, severity, kind, status, title, message, payload_json, created_at, updated_at, acknowledged_at
)
SELECT
  id, job_id, file_id, severity, alert_type, status, title, message, payload_json, created_at, updated_at, acknowledged_at
FROM ingest_alerts_legacy;

DROP TABLE ingest_alerts_legacy;
DROP TABLE ingest_events_legacy;
DROP TABLE ingest_stage_runs_legacy;
DROP TABLE ingest_files_legacy;
DROP TABLE ingest_jobs_legacy;

CREATE INDEX idx_ingest_jobs_status_updated
  ON ingest_jobs(status, updated_at);

CREATE INDEX idx_ingest_jobs_last_heartbeat
  ON ingest_jobs(last_heartbeat_at);

CREATE INDEX idx_ingest_files_job_status
  ON ingest_files(job_id, status);

CREATE INDEX idx_ingest_stage_runs_job_stage_started
  ON ingest_stage_runs(job_id, stage, started_at);

CREATE INDEX idx_ingest_events_job_created
  ON ingest_events(job_id, created_at);

CREATE INDEX idx_ingest_alerts_status_created
  ON ingest_alerts(status, created_at);

PRAGMA foreign_keys = ON;
