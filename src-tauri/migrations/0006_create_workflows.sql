CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  workflow_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON workflows(updated_at DESC);
