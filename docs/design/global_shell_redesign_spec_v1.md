# Global Shell Redesign Spec v1

## Definition of Done
- App shell updated to premium dark desktop style with clear nav hierarchy.

## User Goal
- Instantly understand where core work happens.

## Design / System Goal
- Stable, low-noise shell with explicit active states.

## Tests
- Shell route rendering and nav class checks.

## Findings
- P1 resolved: mixed shell style and weak grouping.

## Evidence
- Sidebar groups and nav links: `src/app/AppShell.tsx:76-109`.
- Header badges and shell surfaces: `src/app/AppShell.tsx:119-130`.

## Changes Applied
- Rebuilt shell styling and nav grouping.

## Re-test Results
- Tests/build pass.

## Remaining Risks
- Mobile-width shell behavior remains less optimized than desktop (acceptable for desktop-first scope).

## Shell Rules
1. Split nav into Core Workflows and Support groups.
2. Keep SOPHON in Core Workflows.
3. Use stable top header with subdued context chips.
4. Keep layout max width generous for desktop (`max-w-[1500px]`).
5. Preserve one main content pane with consistent padding.
