CREATE TABLE IF NOT EXISTS custom_library_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_library_tool_versions (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  version TEXT NOT NULL,
  changelog_md TEXT,
  instructions_md TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tool_id) REFERENCES custom_library_tools(id) ON DELETE CASCADE,
  UNIQUE (tool_id, version)
);

CREATE TABLE IF NOT EXISTS custom_library_tool_files (
  id TEXT PRIMARY KEY,
  tool_version_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  -- Files are stored under app data dir using this relative convention:
  -- tools/<tool_id>/<tool_version_id>/files/<sanitized_original_filename>
  stored_rel_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mime TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tool_version_id) REFERENCES custom_library_tool_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS custom_library_tool_tags (
  tool_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (tool_id, tag),
  FOREIGN KEY (tool_id) REFERENCES custom_library_tools(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_custom_library_tools_slug
  ON custom_library_tools(slug);
CREATE INDEX IF NOT EXISTS idx_custom_library_tools_name
  ON custom_library_tools(name);
CREATE INDEX IF NOT EXISTS idx_custom_library_tool_versions_tool_version
  ON custom_library_tool_versions(tool_id, version);
CREATE INDEX IF NOT EXISTS idx_custom_library_tool_files_version_id
  ON custom_library_tool_files(tool_version_id);
