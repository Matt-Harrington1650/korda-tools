# Desktop Services

This directory contains desktop-only service boundaries.

Use these rules:
- Keep privileged integrations (SQLite, secrets, native paths) behind interfaces.
- Do not import `@tauri-apps/*` at module top-level in shared web code paths.
- Route desktop service creation through runtime-gated factories.
- Keep web implementations explicit and fail fast with "not supported".

Planned services:
- `secrets/`: OS keychain-backed secret vault implementations.
- `sqlite/`: SQLite database client implementations.
- `files/`: user-scoped file selection and run-output export.
- `notifications/`: desktop notification wrappers for scheduler/run status.
- `updater/`: app update check/install wrappers via Tauri updater plugin.
