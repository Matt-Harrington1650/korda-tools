# Operational Notes

Date: 2026-02-25

## Core Validation Commands

From repo root:

- Frontend tests:
  - `npm run test`
- Lint:
  - `npm run lint`
- Frontend production build:
  - `npm run build`

From `src-tauri`:

- Rust compile check:
  - `cargo check`
- Custom-tools targeted tests:
  - `cargo test tools:: -- --nocapture`
- Full Rust tests:
  - `cargo test`

## Stress/Security Focus Commands

- Run custom-tools stress/integrity suite:
  - `cargo test tools::storage::tests::stages_many_files_with_deterministic_unique_names -- --nocapture`
  - `cargo test tools::zip::tests::stress_repeated_import_round_trips -- --nocapture`
  - `cargo test tools::zip::tests::rejects_zip_slip_entries -- --nocapture`

## Build Desktop Artifact

From repo root:

- `npm run tauri:build`

Output:
- `src-tauri/target/release/app.exe`
- `src-tauri/target/release/bundle/nsis/Korda Tools_0.1.0_x64-setup.exe`

## Manual Smoke Sequence (Recommended)

1. Launch app.
2. Create registry tool, open detail, run test action.
3. Create workflow and execute.
4. Use Chat page to call tool and save recipe.
5. In `/tools`, add custom tool with files and instructions.
6. Open custom tool detail and export version.
7. Import exported zip and verify metadata/files/instructions match.
8. Delete custom tool and verify it disappears from list.
