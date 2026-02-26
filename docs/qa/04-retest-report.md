# Retest Report

Date: 2026-02-25

## Baseline Results (Before Patch Batch)

- Frontend tests: `npm run test` -> pass (`15 files`, `54 tests`)
- Frontend build: `npm run build` -> pass
- Rust checks: `cargo check` -> pass
- Rust tests: `cargo test` -> pass for existing tests
- Lint: `npm run lint` -> failed with multiple blocking errors
  - generated Tauri artifact parse errors
  - unused underscore args
  - `prefer-const` issue
  - hook warnings/errors

## Post-Patch Results

- Frontend tests: `npm run test` -> pass (`15 files`, `54 tests`)
- Frontend lint: `npm run lint` -> pass with warnings only (`2 warnings`, `0 errors`)
- Frontend build: `npm run build` -> pass
- Rust tools suite: `cargo test tools:: -- --nocapture` -> pass (`14 passed`, `0 failed`)

## Newly Added Test Outcomes

- `tools::storage::tests::rejects_allowlist_bypass_file_names` -> pass
- `tools::storage::tests::stages_many_files_with_deterministic_unique_names` -> pass
- `tools::zip::tests::manifest_integrity_rejects_duplicate_file_names` -> pass
- `tools::zip::tests::stress_repeated_import_round_trips` -> pass

## Security Regression Checkpoints

- Traversal patterns rejected:
  - `../...`
  - `..\\...`
  - `C:\\...`
  - `\\\\server\\share\\...`
  - `/absolute/...`
- Zip slip malicious entries rejected
- Manifest hash mismatch rejected
- Duplicate file entries in manifest rejected
