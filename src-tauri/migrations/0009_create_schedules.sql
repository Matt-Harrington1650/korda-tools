CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  kind TEXT NOT NULL,
  next_run_at INTEGER,
  updated_at INTEGER NOT NULL,
  schedule_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedules_workflow_id ON schedules(workflow_id);
CREATE INDEX IF NOT EXISTS idx_schedules_enabled_next_run ON schedules(enabled, next_run_at);
