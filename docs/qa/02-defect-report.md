# Defect Report

Date: 2026-02-25

## D-001 Lint pipeline scanned generated binary artifacts
- Severity: Medium
- Area: Tooling / CI stability
- Repro:
  1. Build Tauri app.
  2. Run `npm run lint`.
  3. ESLint parses files under `src-tauri/target/.../tauri-codegen-assets/*.js` and fails with parse errors.
- Root cause: ESLint ignore list only excluded `dist`, not Tauri build output.
- Fix: Added `src-tauri/target/**` to global ignores in ESLint config.
- Status: Fixed

## D-002 Lint false positives for intentional stub parameters
- Severity: Medium
- Area: Web fallback implementations / tests
- Repro: `npm run lint` raised many `@typescript-eslint/no-unused-vars` errors for underscore-prefixed params.
- Root cause: ESLint rule did not permit underscore naming convention used for intentionally unused args.
- Fix: Configured `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: '^_'`.
- Status: Fixed

## D-003 React hook dependency warning in chat trace map
- Severity: Low
- Area: Chat UI rendering consistency
- Repro: `npm run lint` warned about missing dependency in `ChatPage` `useMemo`.
- Root cause: Dependency array used `selectedThread?.toolCalls` instead of `selectedThread`.
- Fix: Updated dependency array to `[selectedThread]`.
- Status: Fixed

## D-004 Manifest duplicate file detection was case-sensitive
- Severity: High
- Area: Custom tools import integrity
- Repro: Provide manifest entries with effectively duplicate names differing only by case on Windows.
- Root cause: Duplicate check in import used case-sensitive set.
- Fix: Changed duplicate detection to case-insensitive (`to_ascii_lowercase`) in import validation path.
- Status: Fixed

## D-005 Custom tools stress/security coverage gaps
- Severity: Medium
- Area: Test depth for import/export and staging
- Repro: Prior suite lacked high-volume staging and repeated round-trip stress coverage.
- Root cause: Tests focused on basic correctness but not sustained/repeated scenarios.
- Fix: Added stress and security tests for high-volume staging, repeated zip round-trips, allowlist bypass attempts, and duplicate-manifest integrity.
- Status: Fixed

## D-006 Lint failure on `prefer-const` in execution pipeline
- Severity: Low
- Area: Execution pipeline quality gate
- Repro: `npm run lint` flagged mutable `queueState` binding that was never reassigned.
- Root cause: `let` used where `const` was sufficient.
- Fix: Converted to `const`.
- Status: Fixed

## Residual Issues (Non-blocking)
- React Hook Form `watch()` compatibility warnings in:
  - `src/pages/AddToolPage.tsx`
  - `src/pages/ToolDetailPage.tsx`
- These are warnings, not runtime failures, and remain for future refactor.
