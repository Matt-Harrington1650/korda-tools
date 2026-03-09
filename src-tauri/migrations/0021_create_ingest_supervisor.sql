CREATE TABLE IF NOT EXISTS ingest_jobs (
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

CREATE TABLE IF NOT EXISTS ingest_files (
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

CREATE TABLE IF NOT EXISTS ingest_stage_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  file_id TEXT,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ended_at INTEGER,
  progress_pct REAL NOT NULL DEFAULT 0,
  detail_message TEXT,
  heartbeat_at INTEGER,
  duration_ms INTEGER,
  FOREIGN KEY (job_id) REFERENCES ingest_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES ingest_files(file_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingest_events (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  file_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES ingest_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES ingest_files(file_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingest_alerts (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  file_id TEXT,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_status_updated
  ON ingest_jobs(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_last_heartbeat
  ON ingest_jobs(last_heartbeat_at);

CREATE INDEX IF NOT EXISTS idx_ingest_files_job_status
  ON ingest_files(job_id, status);

CREATE INDEX IF NOT EXISTS idx_ingest_stage_runs_job_stage_started
  ON ingest_stage_runs(job_id, stage, started_at);

CREATE INDEX IF NOT EXISTS idx_ingest_events_job_created
  ON ingest_events(job_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ingest_alerts_status_created
  ON ingest_alerts(status, created_at);
