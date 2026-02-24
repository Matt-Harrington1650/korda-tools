CREATE TABLE IF NOT EXISTS workflow_node_runs (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  workflow_step_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  status TEXT NOT NULL,
  node_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_run_ts
  ON workflow_node_runs(workflow_run_id, ts ASC);
