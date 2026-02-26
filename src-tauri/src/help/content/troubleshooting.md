# Troubleshooting

## Common errors and fixes

| Symptom | Likely cause | Recommended fix |
|---|---|---|
| "Tool could not be loaded" | Missing record, stale route ID, or DB inconsistency | Return to Tools list, refresh, re-import package, then open again. |
| Import fails on zip validation | Unsafe path, bad hash, unsupported extension | Rebuild export package and verify `manifest.json` entries. |
| Save fails with size error | Per-file or total package size exceeded | Split assets into multiple versions or reduce bundled docs. |
| Workflow run fails quickly | Missing credentials or bad step configuration | Check Settings and workflow step payloads. |

## Diagnostic checklist

1. Confirm the app can access its local data directory.
2. Verify tool/version IDs exist in the database.
3. Re-open the latest version and compare file hashes.
4. Export and import the same package to validate round-trip behavior.

## Windows path reminders

- Do not use traversal paths such as `../` or `..\\`.
- Avoid absolute import references inside manifests.
- Keep file names simple and extension-allowlisted.

## Need orientation?

- [Quick Start](help://quick-start)
- [Tools Library](help://tools-library)
