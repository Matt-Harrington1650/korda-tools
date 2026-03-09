# Sophon UI Design System v1

## Definition of Done
- Unified dark design language defined for SOPHON and global shell.

## User Goal
- Fast comprehension, low fatigue, and high trust while operating SOPHON.

## Design / System Goal
- Black/charcoal foundation with disciplined blue accent hierarchy and consistent interaction semantics.

## Tests (steps + commands + expected result + actual result)
1. Implement token/classes in `src/index.css`.
- Expected: single source of visual truth.
- Actual: implemented under `:root`, `@layer components`, `@layer utilities`.

2. Apply across shell + SOPHON pages.
- Expected: no mixed visual language in core flow.
- Actual: applied in `AppShell` and all SOPHON pages.

## Findings (severity-ranked P0/P1/P2/P3)
- P0: none.
- P1: pre-overhaul lacked shared token layer; resolved.
- P2: non-SOPHON pages still partly legacy utility-based but now normalized by compatibility utilities.

## Evidence (file paths + line ranges + screenshots + DOM evidence + runtime output)
- Theme tokens and core primitives: `src/index.css:5-420`.
- Shell implementation: `src/app/AppShell.tsx:68-170`.
- SOPHON shell and pages: `src/pages/sophon/*.tsx`.
- Functional pass evidence: `npm run test`, `npm run build`.

## Changes Applied
- Introduced `kt-*` component classes and utility compatibility layer.

## Re-test Results
- Typecheck/test/build all pass.

## Remaining Risks
- Token migration for every non-SOPHON feature module is incremental.

## Core Design Language
- Foundation: near-black canvas with charcoal layered surfaces.
- Accent: blue for primary action, focus, active selection, and information emphasis.
- Text hierarchy: high-contrast primary, softer secondary, muted metadata.
- Components: shared panel/button/input/status/tab classes.
- Motion: restrained; color/border transitions only.
- Density: compact but breathable with consistent card padding and section spacing.
