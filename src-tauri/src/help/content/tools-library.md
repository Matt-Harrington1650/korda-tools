# Tools Library

Use the Tools Library to package and share custom tool assets with instructions.

## Core actions

| Action | What it does |
|---|---|
| Add Tool | Creates metadata, instructions, and a first version with files. |
| Add Version | Publishes a new version for an existing tool slug. |
| Export | Builds a `.zip` package with `manifest.json`, `instructions.md`, and `files/`. |
| Import | Validates package safety and creates/merges records by slug/version rules. |

## AutoCAD use case

1. Create a tool such as "AutoCAD Plot Macro Pack".
2. Select an instruction template (`.LSP/.VLX/.FAS`, `.SCR`, or `.CUIX`).
3. Attach script files and supporting docs.
4. Save and test install steps in AutoCAD on a staging machine.
5. Export and share the package with teammates.

## Import and export notes

- Import rejects unsafe zip paths (absolute paths, drive-letter paths, traversal).
- File extension allowlist and size limits are enforced.
- Files are stored locally and never executed by this app.

## Related pages

- [Workflows Overview](help://workflows-overview)
- [Troubleshooting](help://troubleshooting)
