# Patch Set Summary

Date: 2026-02-25

## Commit Group A: Tests
Recommended commit message:
- `test(custom-tools): add stress and integrity tests for staging/import/export`

Files:
- `src-tauri/src/tools/storage.rs`
- `src-tauri/src/tools/zip.rs`

Added coverage:
- allowlist bypass attempts
- high-volume file staging
- repeated import round-trips
- duplicate-manifest rejection
- traversal/zip-slip checks (extended)

## Commit Group B: Bug Fixes
Recommended commit message:
- `fix(ui): improve chat memo dependency and custom-tools invoke arg compatibility`

Files:
- `src/pages/ChatPage.tsx`
- `src/desktop/customTools/TauriCustomToolsLibraryService.ts`

Changes:
- fixed hook dependency warning path in chat trace map
- made custom-tools invoke payloads tolerant to snake_case/camelCase argument names

## Commit Group C: Hardening
Recommended commit message:
- `fix(custom-tools): enforce case-insensitive duplicate manifest file detection`

Files:
- `src-tauri/src/tools/zip.rs`

Changes:
- import duplicate-name detection now uses normalized lowercase keying to match Windows file semantics

## Commit Group D: Tooling/Docs
Recommended commit messages:
- `chore(lint): ignore tauri target artifacts and allow underscore args`
- `docs(qa): add full functionality review reports`

Files:
- `eslint.config.js`
- `docs/qa/*.md`

Changes:
- lint no longer scans generated binary assets
- lint no longer fails on intentional underscore placeholder args
- QA deliverables documented
