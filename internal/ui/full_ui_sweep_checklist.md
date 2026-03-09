# Full UI Sweep Checklist

## Definition of Done
- Every major touched surface checked for visual and functional integrity.

## User Goal
- Core workflows continue to work after the redesign.

## Design / System Goal
- Ensure consistency, trust cues, and no functional regressions.

## Tests
- `npm run typecheck`
- `npm run test`
- `npm run build`
- route-level and component-level source verification.

## Findings (severity-ranked P0/P1/P2/P3)
- P0: none.
- P1: none after retest.
- P2: large bundle warning remains unrelated to UI redesign.

## Evidence
- `npm run test` -> 32/32 files, 92/92 tests passing.
- `npm run build` -> success, chunk-size warning only.

## Changes Applied
- Checklist execution only.

## Re-test Results
- Passed.

## Remaining Risks
- Real window-resize user timing not instrumented.

## Checklist
- [x] App launch shell renders.
- [x] Sidebar/nav active states visible.
- [x] Dashboard hero + SOPHON CTA visible.
- [x] SOPHON layout summary and tabs render.
- [x] SOPHON dashboard actions render.
- [x] SOPHON source form and list render.
- [x] SOPHON ingestion jobs controls render.
- [x] SOPHON index controls and snapshots render.
- [x] SOPHON retrieval run/export controls render.
- [x] SOPHON tuning checkboxes/inputs render.
- [x] SOPHON policy/audit severity chips render.
- [x] SOPHON backup/restore textarea/actions render.
- [x] SOPHON settings readiness cards render.
- [x] Empty states use shared style.
- [x] Focus ring style centralized.
- [x] Typecheck passes.
- [x] Tests pass.
- [x] Build passes.
