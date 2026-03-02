PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  current_version_no INTEGER NOT NULL CHECK (current_version_no > 0),
  status TEXT NOT NULL CHECK (status IN ('finalized')),
  created_by TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS deliverable_versions (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  artifact_id TEXT NOT NULL,
  artifact_hash TEXT NOT NULL CHECK (length(artifact_hash) = 64 AND artifact_hash GLOB '[0-9a-f]*'),
  parent_version_id TEXT,
  change_reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (parent_version_id) REFERENCES deliverable_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (deliverable_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_deliverables_project_updated
  ON deliverables(project_id, updated_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_deliverable_versions_chain
  ON deliverable_versions(deliverable_id, version_no DESC);

CREATE INDEX IF NOT EXISTS idx_deliverable_versions_artifact_hash
  ON deliverable_versions(deliverable_id, artifact_hash);

CREATE TRIGGER IF NOT EXISTS trg_deliverable_versions_no_update
BEFORE UPDATE ON deliverable_versions
BEGIN
  SELECT RAISE(ABORT, 'deliverable_versions rows are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_deliverable_versions_no_delete
BEFORE DELETE ON deliverable_versions
BEGIN
  SELECT RAISE(ABORT, 'deliverable_versions rows are append-only and cannot be deleted');
END;

COMMIT;