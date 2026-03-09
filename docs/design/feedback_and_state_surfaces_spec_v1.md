# Feedback And State Surfaces Spec v1

## Definition of Done
- Status, empty, warning, and trust surfaces follow one visual grammar.

## User Goal
- Quickly understand whether the system is ready, blocked, or successful.

## Design / System Goal
- Improve trust by making state transitions and severity obvious.

## Tests
- Reviewed status/empty/error patterns across SOPHON pages and shared components.

## Findings
- P1 resolved: status surfaces now consistent in form and color semantics.

## Evidence
- Status classes: `src/index.css:235-264`.
- Empty state component: `src/components/EmptyState.tsx:9-13`.
- Readiness severity cards: `src/pages/sophon/SophonSettingsPage.tsx:226-248`.
- Audit severity chips: `src/pages/sophon/SophonPoliciesAuditPage.tsx:95-103`.

## Changes Applied
- Normalized status chips, empty-state containers, and warning/error panel treatments.

## Re-test Results
- Functional tests and smoke tests passed.

## Remaining Risks
- Toast subsystem remains legacy and could be fully migrated to tokenized component primitives in a follow-up.

## State Surface Rules
1. Use `kt-status` variants for compact status labels.
2. Use `kt-panel-muted` for informational and empty states.
3. Escalate warning/error with semantic border tint only; avoid noisy fills.
4. Keep feedback near the action source.
5. Do not report success when readiness or dependency checks fail.
