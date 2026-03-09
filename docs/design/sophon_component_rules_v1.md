# Sophon Component Rules v1

## Definition of Done
- Reusable component behavior and usage constraints documented.

## User Goal
- Interaction patterns feel consistent regardless of SOPHON page.

## Design / System Goal
- Enforce one component language for panel, form, action, and state surfaces.

## Tests
- Source inspection for `kt-*` class usage across SOPHON pages.

## Findings
- P1 resolved: button/input/status inconsistencies reduced.

## Evidence
- Button classes: `src/index.css:118-183`.
- Input classes: `src/index.css:185-209`.
- Status classes: `src/index.css:235-264`.
- SOPHON page usage: `src/pages/sophon/*.tsx`.

## Changes Applied
- Component rules implemented and adopted.

## Re-test Results
- All tests pass.

## Remaining Risks
- Non-SOPHON feature modules still need full `kt-*` adoption over time.

## Rules
1. Use `kt-panel` for standard containers; `kt-panel-elevated` for top-level hero/shell blocks.
2. Use `kt-btn-primary` for dominant action, `kt-btn-secondary` for high-value secondary actions, `kt-btn-ghost` for low-priority controls, `kt-btn-danger` for destructive actions.
3. Use `kt-input`, `kt-select`, `kt-textarea` for all user input controls.
4. Use `kt-status-*` for severity/status badges only.
5. Keep section headings to `kt-title-lg`; metadata labels to `kt-title-sm`.
6. Empty states must use `kt-panel-muted` and include next action guidance.
7. Avoid page-specific one-off color classes unless functionally justified.
