CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  updated_at INTEGER NOT NULL,
  thread_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_updated_at ON chat_threads(updated_at DESC);
