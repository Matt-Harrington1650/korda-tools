# Structured Input System v1

## Executive findings
- The app now uses a structured-first input model for bounded domains.
- Reusable primitives are centralized under `src/components/structured`.
- Preset + custom override is the standard fallback pattern when strict enums are too restrictive.

## Shared primitives
- `CheckboxGroupField`: finite multi-select groups.
  - Evidence: `src/components/structured/CheckboxGroupField.tsx:1`.
- `SegmentedControl`: small finite single-select sets.
  - Evidence: `src/components/structured/SegmentedControl.tsx:1`.
- Structured exports: `src/components/structured/index.ts:1`.

## Control patterns
1. Dropdown
- Use for finite sets >3 options.
- Include `Custom` only when truly needed.
- Persist concrete value, not preset marker.

2. Segmented control
- Use for finite sets with 2-3 high-frequency choices.
- Keep labels short and explicit.

3. Checkbox group / multi-select
- Use for finite inclusion lists (example: file types).
- Show all options when option count is small and scanability matters.

4. Slider / number stepper
- Use for bounded numeric values with safe min/max.
- Show current value near the control.

5. Preset + custom override
- Primary path: preset selection.
- Secondary path: conditional custom field shown only when `Custom` selected.
- Keep schema validation on final persisted field.

6. Freeform exception path
- Keep freeform only for authored content, search, IDs/URLs/paths, markdown, or integration payloads.

## Applied examples
- SOPHON source types and scan depth -> segmented controls.
  - `src/pages/sophon/SophonSourcesPage.tsx:139`, `src/pages/sophon/SophonSourcesPage.tsx:149`.
- SOPHON allowed file types -> checkbox group.
  - `src/pages/sophon/SophonSourcesPage.tsx:191`.
- SOPHON tuning numeric bounds -> sliders/select presets.
  - `src/pages/sophon/SophonModelsTuningPage.tsx:59`, `src/pages/sophon/SophonModelsTuningPage.tsx:89`.
- Settings finite runtime/provider fields -> preset dropdowns + custom fallback.
  - `src/features/settings/components/SettingsPanel.tsx:275`, `src/features/settings/components/SettingsPanel.tsx:335`, `src/features/settings/components/SettingsPanel.tsx:392`.
- Tool categories and header names -> preset dropdowns + custom fallback.
  - `src/pages/AddToolPage.tsx:173`, `src/pages/ToolDetailPage.tsx:424`.

## Validation
- `npm run typecheck`: pass.
- `npm run lint`: pass (warnings only).
- `npm run test`: pass.
- `npm run build`: pass.

## Remaining risks
- Path picker remains freeform in SOPHON sources due cross-target runtime picker limitations.
- Plugin payload/config text remains freeform by design for integration flexibility.
