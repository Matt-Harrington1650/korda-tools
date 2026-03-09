# UI Patch Log

## Definition of Done
- All applied UI patches listed with safety rationale and validation.

## User Goal
- Understand exactly what changed and why it is safe.

## Design / System Goal
- Preserve function while unifying visuals/ergonomics.

## Tests
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Findings (severity-ranked P0/P1/P2/P3)
- P0: none introduced.
- P1: one temporary routing smoke mismatch fixed (text case).

## Evidence
- Passing suite outputs and file-level diffs.

## Changes Applied
- Listed below.

## Re-test Results
- All checks passing.

## Remaining Risks
- Screenshot-based visual diffing not available in CLI run.

| Patch ID | Files changed | Reason for safety | Before evidence | After evidence | Validation command/test | Rollback note |
| -------- | ------------- | ----------------- | --------------- | -------------- | ----------------------- | ------------- |
| UIP-001 | `src/index.css` | Additive token system + shared classes | no centralized theme tokens | tokenized dark system + reusable primitives | `npm run typecheck`, `npm run test` | revert file to prior version |
| UIP-002 | `src/app/AppShell.tsx` | presentation refactor only; no state logic changes | mixed light nav and weak grouping | grouped core/support nav and consistent active states | SOPHON route smoke + full tests | revert file |
| UIP-003 | `src/pages/sophon/SophonLayout.tsx` | visual/layout-only; same routes/tabs | mixed gradient/light tabs | unified shell, status, tabs | `npm run test` | revert file |
| UIP-004 | `src/pages/sophon/Sophon*.tsx` (all major pages) | class-level restyle, no store contract changes | inconsistent controls and card styles | consistent panel/button/input/status system | `npm run test` (includes SOPHON tests) | revert touched page files |
| UIP-005 | `src/components/EmptyState.tsx`, `src/components/PageShell.tsx`, `src/components/AppLayout.tsx` | shared UI primitive normalization | inconsistent empty state and shell cards | consistent shared surface style | `npm run test` | revert files |
| UIP-006 | `src/pages/DashboardPage.tsx`, `src/pages/SettingsPage.tsx` | additive content/layout for discoverability | SOPHON not strongly promoted | SOPHON CTA + quick guide + unified settings header | `npm run build` | revert files |
| UIP-007 | `src/pages/sophon/SophonLayout.tsx`, `src/app/AppShell.tsx` | text-case compatibility fix | failing smoke test (`SOPHON` mismatch) | tests pass with `Sophon` text | `npm run test` | revert two lines |
