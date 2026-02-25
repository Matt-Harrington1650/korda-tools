CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_library_tool_files_version_name_unique
  ON custom_library_tool_files(tool_version_id, lower(original_name));

CREATE INDEX IF NOT EXISTS idx_custom_library_tool_tags_tag
  ON custom_library_tool_tags(tag);
