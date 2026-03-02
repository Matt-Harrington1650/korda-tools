CREATE TABLE IF NOT EXISTS project_role_bindings (
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('project_owner', 'records_publisher', 'records_viewer', 'ai_operator')),
  granted_by TEXT NOT NULL,
  granted_at_utc TEXT NOT NULL,
  revoked_at_utc TEXT,
  PRIMARY KEY (project_id, actor_id, role),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_project_role_bindings_actor_project_active
  ON project_role_bindings(actor_id, project_id, revoked_at_utc);

CREATE INDEX IF NOT EXISTS idx_project_role_bindings_project_role_active
  ON project_role_bindings(project_id, role, revoked_at_utc);

CREATE TABLE IF NOT EXISTS policy_overrides (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  sensitivity_level TEXT NOT NULL CHECK (sensitivity_level IN ('Public','Internal','Confidential','Client-Confidential')),
  reason TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  expires_at_utc TEXT,
  created_at_utc TEXT NOT NULL,
  revoked_at_utc TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_policy_overrides_lookup_active
  ON policy_overrides(project_id, actor_id, provider_id, sensitivity_level, revoked_at_utc, expires_at_utc);
