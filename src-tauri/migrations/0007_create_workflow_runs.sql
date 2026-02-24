CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  status TEXT NOT NULL,
  run_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_ts
  ON workflow_runs(workflow_id, ts DESC);
