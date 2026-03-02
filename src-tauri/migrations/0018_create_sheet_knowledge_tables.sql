CREATE TABLE IF NOT EXISTS sheets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  package_id TEXT,
  artifact_id TEXT NOT NULL,
  sheet_number TEXT NOT NULL,
  title TEXT NOT NULL,
  discipline TEXT NOT NULL,
  revision TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  sheet_status TEXT NOT NULL,
  authoritative_format TEXT NOT NULL DEFAULT 'PDF/A',
  ocr_confidence REAL,
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE(project_id, sheet_number, revision, issue_date)
);

CREATE TABLE IF NOT EXISTS sheet_references (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_sheet_id TEXT NOT NULL,
  target_sheet_id TEXT,
  target_ref_type TEXT NOT NULL,
  target_ref_id TEXT NOT NULL,
  source_callout_text TEXT,
  confidence_score REAL,
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (source_sheet_id) REFERENCES sheets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (target_sheet_id) REFERENCES sheets(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sheet_rfi_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  rfi_id TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('mentioned_on', 'impacts', 'resolved_by')),
  confidence_score REAL,
  created_at_utc TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (rfi_id) REFERENCES artifacts(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sheet_submittal_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  submittal_id TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('required_by', 'satisfied_by', 'deviates_from')),
  confidence_score REAL,
  created_at_utc TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (submittal_id) REFERENCES artifacts(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sheet_outcome_signals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('coordination_risk', 'field_conflict', 'late_change', 'quality_flag')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  score REAL NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('rule', 'ml', 'manual')),
  explanation TEXT,
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sheets_project_sheet_number
  ON sheets(project_id, sheet_number);

CREATE INDEX IF NOT EXISTS idx_sheets_project_revision_issue_date
  ON sheets(project_id, revision, issue_date);

CREATE INDEX IF NOT EXISTS idx_sheets_package
  ON sheets(package_id);

CREATE INDEX IF NOT EXISTS idx_sheet_references_source
  ON sheet_references(source_sheet_id);

CREATE INDEX IF NOT EXISTS idx_sheet_references_target
  ON sheet_references(target_ref_type, target_ref_id);

CREATE INDEX IF NOT EXISTS idx_sheet_references_project
  ON sheet_references(project_id, created_at_utc);

CREATE INDEX IF NOT EXISTS idx_sheet_rfi_links_sheet
  ON sheet_rfi_links(sheet_id);

CREATE INDEX IF NOT EXISTS idx_sheet_rfi_links_rfi
  ON sheet_rfi_links(rfi_id);

CREATE INDEX IF NOT EXISTS idx_sheet_submittal_links_sheet
  ON sheet_submittal_links(sheet_id);

CREATE INDEX IF NOT EXISTS idx_sheet_submittal_links_submittal
  ON sheet_submittal_links(submittal_id);

CREATE INDEX IF NOT EXISTS idx_sheet_outcome_signals_sheet
  ON sheet_outcome_signals(sheet_id, severity);

CREATE INDEX IF NOT EXISTS idx_sheet_outcome_signals_project_type
  ON sheet_outcome_signals(project_id, signal_type, created_at_utc);