# Settings And Forms Redesign Spec v1

## Definition of Done
- Settings/forms surfaces share spacing, labels, control styling, and status feedback language.

## User Goal
- Complete form-heavy tasks confidently with low error risk.

## Design / System Goal
- Strong label hierarchy and reliable control semantics.

## Tests
- Reviewed SOPHON Sources, Models/Tuning, Settings, and global Settings page.

## Findings
- P1 resolved: inconsistent form controls and message styling.

## Evidence
- Sources form: `src/pages/sophon/SophonSourcesPage.tsx:80-166`.
- Tuning form: `src/pages/sophon/SophonModelsTuningPage.tsx:28-124`.
- Advanced settings: `src/pages/sophon/SophonSettingsPage.tsx:163-314`.
- Global settings header: `src/pages/SettingsPage.tsx:5-10`.

## Changes Applied
- Inputs unified via `kt-input/kt-select/kt-textarea`; labels via `kt-title-sm`; actions via `kt-btn-*`.

## Re-test Results
- Test suite passing.

## Remaining Risks
- Field-level validation microcopy still feature-specific (future standardization candidate).

## Form Rules
1. Every field group uses uppercase small label (`kt-title-sm`).
2. Inputs share dark background and focus ring.
3. Destructive actions always use danger treatment.
4. Success/error inline messages use semantic color and muted panel.
5. Checkbox rows use consistent container and `kt-checkbox`.
