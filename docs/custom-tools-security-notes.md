# Custom Tools Library Security Notes

## File type allowlist
Only these file extensions are accepted for tool package files:

- `.lsp`
- `.vlx`
- `.fas`
- `.scr`
- `.dwg`
- `.dxf`
- `.cuix`
- `.zip`
- `.pdf`
- `.txt`
- `.md`
- `.json`

Any file outside this allowlist is rejected by backend validation.

## Size limits
- Max per file: `50 MB`
- Max total size per tool version: `200 MB`

Files exceeding either limit are rejected.

## Storage location
Files are persisted in the app data directory using a strictly relative path convention:

`<AppData>/tools/<tool_id>/<version_id>/files/<sanitized_original_filename>`

The backend enforces normalized relative paths and rejects traversal/absolute/drive-prefixed paths.

## Execution model
Uploaded/imported files are treated as inert assets only.

- The app does **not** execute uploaded scripts/binaries.
- The app stores, lists, exports, and imports files and metadata.
- Any execution of the tool package content is performed manually by users in external software (for example, AutoCAD), following the included instructions.
