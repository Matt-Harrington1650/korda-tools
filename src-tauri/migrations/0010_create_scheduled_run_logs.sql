CREATE TABLE IF NOT EXISTS scheduled_run_logs (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  status TEXT NOT NULL,
  log_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduled_run_logs_workflow_ts
  ON scheduled_run_logs(workflow_id, ts DESC);
