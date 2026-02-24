CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
