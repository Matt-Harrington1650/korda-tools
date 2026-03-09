# Ergonomics And Clutter Map

## Definition of Done
- Product-wide ergonomics issues mapped with severity and targeted fixes.

## User Goal
- Complete core tasks with low pointer travel, low click friction, and clear visual order.

## Design / System Goal
- Reduce clutter, enforce action hierarchy, and standardize readable spacing.

## Tests
- Code surface analysis: `AppShell`, SOPHON pages, dashboard, settings.
- Theming drift query: `rg -n "bg-white|border-slate-200|text-slate-900" src`.

## Findings (severity-ranked P0/P1/P2/P3)
- P1: high cognitive load in source/settings forms.
- P1: inconsistent action affordance semantics.
- P2: text/readability rhythm inconsistency.
- P2: repeated panel patterns without strict system.

## Evidence
- `src/pages/sophon/SophonSourcesPage.tsx:80-204`.
- `src/pages/sophon/SophonSettingsPage.tsx:193-314`.
- `src/app/AppShell.tsx:76-109`.
- `src/index.css:69-420`.

## Changes Applied
- None in this mapping file.

## Re-test Results
- N/A.

## Remaining Risks
- Pointer-travel metrics are inferred from layout, not instrumented telemetry.

| Issue ID | Surface | Problem | User Impact | Severity | Recommended Change | Evidence |
| -------- | ------- | ------- | ----------- | -------- | ------------------ | -------- |
| UIE-001 | App shell nav | Legacy mixed styling reduced scan confidence | Slower orientation | P1 | Unify nav link states/tokens | `src/app/AppShell.tsx:64-109` |
| UIE-002 | SOPHON sources | Too many controls with equal weight | Higher first-time error risk | P1 | Section labels + consistent input/button tokens | `src/pages/sophon/SophonSourcesPage.tsx:80-204` |
| UIE-003 | Ingestion jobs | Action controls visually close to status text | Misclick risk | P2 | Distinct action row with intent styles | `src/pages/sophon/SophonIngestionJobsPage.tsx:34-80` |
| UIE-004 | Retrieval Lab | Answer/passage differentiation weak | Trust friction | P1 | Dedicated answer panel + passage cards | `src/pages/sophon/SophonRetrievalLabPage.tsx:106-135` |
| UIE-005 | SOPHON settings | Dense readiness blocks | Cognitive load | P1 | Grouped readiness cards + severity styles | `src/pages/sophon/SophonSettingsPage.tsx:217-255` |
| UIE-006 | Dashboard | SOPHON entry not dominant | Discoverability friction | P2 | Add primary SOPHON CTA in hero | `src/pages/DashboardPage.tsx:55-82` |
| UIE-007 | Empty states | Inconsistent card style | State ambiguity | P2 | Reusable `kt-panel-muted` empty state | `src/components/EmptyState.tsx:9-13` |
| UIE-008 | Buttons | Mixed style semantics | Action confidence drop | P1 | Central button classes (`kt-btn-*`) | `src/index.css:118-183` |
| UIE-009 | Inputs | Inconsistent backgrounds/borders | Readability drift | P2 | Tokenized input classes | `src/index.css:185-209` |
| UIE-010 | Accessibility focus | Not centralized previously | Keyboard discoverability risk | P2 | global `:focus-visible` ring | `src/index.css:59-62` |
