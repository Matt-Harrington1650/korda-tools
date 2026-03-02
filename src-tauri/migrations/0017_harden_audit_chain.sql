ALTER TABLE audit_log
  ADD COLUMN canonical_payload_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE audit_log
  ADD COLUMN hash_algorithm TEXT NOT NULL DEFAULT 'sha256';

ALTER TABLE audit_log
  ADD COLUMN chain_version INTEGER NOT NULL DEFAULT 1 CHECK (chain_version > 0);

CREATE INDEX IF NOT EXISTS idx_audit_project_chain
  ON audit_log(project_id, event_ts_utc, id);

CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log rows are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log rows are append-only and cannot be deleted');
END;