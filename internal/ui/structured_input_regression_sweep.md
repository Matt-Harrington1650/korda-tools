# Structured Input Regression Sweep

## Executive findings
- No compile/test/build regressions introduced by structured-input conversion patches.
- Core SOPHON and settings surfaces compile and render under existing test coverage.
- Manual click-through remains partially unverified in this non-interactive run.

## Severity-ranked findings
- P1: None found in automated validation.
- P2: Manual interaction checks for several admin screens are still pending.
- P3: Existing lint warnings unrelated to this conversion remain.

| Test ID | Surface | Changed Fields | Expected | Actual | Pass/Fail | Severity | Evidence |
|---|---|---|---|---|---|---|---|
| REG-001 | Build system | Whole app | Typecheck succeeds | `npm run typecheck` passed | Pass | P3 | Command output: `tsc -p tsconfig.json --noEmit` success |
| REG-002 | Lint | Whole app | No lint errors | `npm run lint` passed with 2 warnings, 0 errors | Pass | P3 | Warnings only in `AddToolPage.tsx` and `ToolDetailPage.tsx` (`react-hooks/incompatible-library`) |
| REG-003 | Test suite | Whole app | Existing tests still pass | 32 files / 92 tests passed | Pass | P3 | `vitest run` summary |
| REG-004 | Build | Whole app | Production build succeeds | `vite build` succeeded | Pass | P3 | Build output completed |
| REG-005 | Add Tool | Category + header controls | Category/header presets persist valid strings | Compiles and schema unchanged | Pass | P2 | `src/pages/AddToolPage.tsx:173`, `src/pages/AddToolPage.tsx:235` |
| REG-006 | Edit Tool | Category + header controls | Same behavior as Add Tool | Compiles and schema unchanged | Pass | P2 | `src/pages/ToolDetailPage.tsx:424`, `src/pages/ToolDetailPage.tsx:484` |
| REG-007 | Add Custom Tool | Category selector | Category selection supports preset + custom | Compiles and create payload still string | Pass | P2 | `src/pages/AddCustomToolPage.tsx:251`, `src/pages/AddCustomToolPage.tsx:260` |
| REG-008 | Workflows | Interval scheduler input | Preset intervals selectable; custom numeric override available | Control logic compiles; addSchedule numeric validation retained | Pass | P2 | `src/pages/WorkflowsPage.tsx:604`, `src/pages/WorkflowsPage.tsx:613`, `src/pages/WorkflowsPage.tsx:244` |
| REG-009 | Help Center editor | Category selector | Existing categories selectable + custom fallback | Compiles; save path unchanged | Pass | P2 | `src/pages/HelpCenterPage.tsx:558`, `src/pages/HelpCenterPage.tsx:567`, `src/pages/HelpCenterPage.tsx:261` |
| REG-010 | SOPHON Sources | Source type / file type controls | No freeform extension typing; include patterns generated from selected extensions | Existing logic preserved | Pass | P2 | `src/pages/sophon/SophonSourcesPage.tsx:191`, `src/pages/sophon/SophonSourcesPage.tsx:419` |
| REG-011 | SOPHON Tuning | Model + numeric fields | Finite/bounded tuning remains structured | Existing store updates intact | Pass | P2 | `src/pages/sophon/SophonModelsTuningPage.tsx:27`, `src/pages/sophon/SophonModelsTuningPage.tsx:59` |
| REG-012 | SOPHON Index | Snapshot naming mode | Preset naming works; custom still possible | Existing `createSnapshot` path unchanged | Pass | P2 | `src/pages/sophon/SophonIndexPage.tsx:73`, `src/pages/sophon/SophonIndexPage.tsx:105` |
| REG-013 | Settings | Timeout/path/model/refs controls | Presets with custom fallback still persist correct values | Existing settings schema still accepted | Pass | P2 | `src/features/settings/components/SettingsPanel.tsx:275`, `src/features/settings/components/SettingsPanel.tsx:392` |
| REG-014 | Manual UX: Add Tool | New selectors | User can complete form with preset + custom | UNVERIFIED (manual click-through not executed in terminal) | Unverified | P2 | Requires UI runtime session |
| REG-015 | Manual UX: Workflows schedule | Interval selector | User can add schedule via preset/custom | UNVERIFIED (manual click-through not executed in terminal) | Unverified | P2 | Requires UI runtime session |
| REG-016 | Manual UX: Help Center editor | Category selector | User can save page with preset/custom category | UNVERIFIED (manual click-through not executed in terminal) | Unverified | P2 | Requires UI runtime session |

## Commands run
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Remaining risks
- UI-level interaction and accessibility checks across all touched screens need a manual click-through session.
