# Sophon Theme Tokens v1

## Definition of Done
- Token dictionary documented and linked to implementation.

## User Goal
- Predictable visual semantics across all SOPHON states.

## Design / System Goal
- Eliminate ad hoc color and spacing decisions.

## Tests
- Token validation by implementation review + passing build.

## Findings
- P1 resolved: tokenless theme drift replaced by centralized variables.

## Evidence
- `src/index.css:5-30` for token declarations.
- `src/index.css:69-420` for token usage in classes.

## Changes Applied
- Added token set and utility compatibility mapping.

## Re-test Results
- Build + tests pass.

## Remaining Risks
- No automated token-consumption lint rule yet.

## Token Catalog
- Backgrounds
  - `--kt-bg-canvas`
  - `--kt-bg-sidebar`
  - `--kt-surface-1`
  - `--kt-surface-2`
  - `--kt-surface-3`
  - `--kt-input-bg`
- Borders
  - `--kt-border`
  - `--kt-border-strong`
- Accent and interaction
  - `--kt-accent`
  - `--kt-accent-hover`
  - `--kt-accent-active`
  - `--kt-accent-soft`
  - `--kt-focus`
- Text
  - `--kt-text-primary`
  - `--kt-text-secondary`
  - `--kt-text-muted`
  - `--kt-text-disabled`
- Semantic status
  - `--kt-success`
  - `--kt-warning`
  - `--kt-danger`
  - `--kt-info`
- Shape
  - `--kt-radius-sm`
  - `--kt-radius-md`
  - `--kt-radius-lg`
