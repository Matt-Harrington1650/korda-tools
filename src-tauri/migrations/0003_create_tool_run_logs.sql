CREATE TABLE IF NOT EXISTS tool_run_logs (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  success INTEGER NOT NULL,
  request_json TEXT,
  response_json TEXT,
  error_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_tool_run_logs_tool_ts
  ON tool_run_logs(tool_id, ts DESC);
