ALTER TABLE ai_queries
  ADD COLUMN review_required INTEGER NOT NULL DEFAULT 0 CHECK (review_required IN (0, 1));

ALTER TABLE ai_queries
  ADD COLUMN review_reasons_json TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_queries_review_required
  ON ai_queries(project_id, review_required, created_at_utc DESC);
