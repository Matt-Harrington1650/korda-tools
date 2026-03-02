CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  UNIQUE(workspace_id, name),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  discipline TEXT NOT NULL,
  status TEXT NOT NULL,
  sensitivity_level TEXT NOT NULL CHECK (sensitivity_level IN ('Public','Internal','Confidential','Client-Confidential')),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 GLOB '[0-9a-f]*'),
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  original_name TEXT NOT NULL,
  revision TEXT,
  document_date TEXT,
  sheet_number TEXT,
  voltage_class TEXT,
  system_category TEXT,
  confidence_score REAL CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  created_by TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  immutable INTEGER NOT NULL DEFAULT 1 CHECK (immutable = 1),
  UNIQUE(project_id, sha256),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS provenance_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'import', 'generated', 'external_ref')),
  source_ref TEXT NOT NULL,
  citation TEXT,
  captured_at_utc TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS retention_policies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL CHECK (retention_days > 0),
  legal_hold INTEGER NOT NULL DEFAULT 0 CHECK (legal_hold IN (0,1)),
  purge_mode TEXT NOT NULL CHECK (purge_mode IN ('soft_delete', 'hard_delete_disabled')),
  effective_from_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_ts_utc TEXT NOT NULL,
  prev_hash TEXT CHECK (prev_hash IS NULL OR (length(prev_hash) = 64 AND prev_hash GLOB '[0-9a-f]*')),
  event_hash TEXT NOT NULL UNIQUE CHECK (length(event_hash) = 64 AND event_hash GLOB '[0-9a-f]*'),
  metadata_json TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ai_queries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  response_text TEXT,
  provider_id TEXT,
  model_id TEXT,
  external_ai_used INTEGER NOT NULL CHECK (external_ai_used IN (0,1)),
  policy_decision TEXT NOT NULL CHECK (policy_decision IN ('allowed', 'blocked', 'override')),
  citation_count INTEGER NOT NULL DEFAULT 0 CHECK (citation_count >= 0),
  provenance_record_id TEXT,
  confidence_score REAL,
  corpus_coverage_pct REAL,
  newest_source_date TEXT,
  created_by TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (provenance_record_id) REFERENCES provenance_records(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace_status
  ON projects(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_artifacts_project_created
  ON artifacts(project_id, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_artifacts_sha256
  ON artifacts(sha256);

CREATE INDEX IF NOT EXISTS idx_provenance_project_artifact_captured
  ON provenance_records(project_id, artifact_id, captured_at_utc);

CREATE INDEX IF NOT EXISTS idx_audit_project_event_ts
  ON audit_log(project_id, event_ts_utc);

CREATE INDEX IF NOT EXISTS idx_audit_project_entity_event_ts
  ON audit_log(project_id, entity_type, entity_id, event_ts_utc);

CREATE INDEX IF NOT EXISTS idx_ai_queries_project_created
  ON ai_queries(project_id, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_ai_queries_project_external_created
  ON ai_queries(project_id, external_ai_used, created_at_utc);