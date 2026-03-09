# Input Control Selection Rules v1

## Executive findings
- Selection policy is now explicit: constrain first, freeform second.
- Rules are tuned for dark desktop UX with low cognitive load.

## Rule set
1. Boolean values
- Use checkbox/switch.
- Never use text (`true/false`, `yes/no`) for persisted booleans.

2. Finite single choice
- Use segmented control for <=3 options.
- Use dropdown for 4+ options.
- Use combobox when option count is large and searchable.

3. Finite multi-choice
- Use checkbox group when option count is small and always visible.
- Use multi-select when option count is larger.

4. Bounded numeric values
- Use slider for continuous bounded ranges.
- Use stepped dropdown or number stepper for discrete values.

5. Date/time/path/file values
- Use pickers when available.
- If picker is unavailable across target runtimes, use freeform with helper text and validation.

6. Preset + custom override
- Default to preset list.
- Show custom input only when `Custom` is selected.
- Persist normalized final value only.

7. Freeform-only cases
- User-authored prompts, notes, markdown, long descriptions.
- Full-text search/filter phrases.
- Open domain IDs/URLs/paths.

## Applied thresholds
- Dropdown threshold: 4+ options.
- Segmented threshold: up to 3 options.
- Slider use: bounded 0..1 thresholds (score/reranker).
- Interval presets: `[1,5,10,15,30,60,120]` minutes with optional custom override.

## Evidence
- Rule application in SOPHON sources: `src/pages/sophon/SophonSourcesPage.tsx:139`, `src/pages/sophon/SophonSourcesPage.tsx:191`.
- Rule application in SOPHON tuning: `src/pages/sophon/SophonModelsTuningPage.tsx:59`, `src/pages/sophon/SophonModelsTuningPage.tsx:121`.
- Rule application in settings: `src/features/settings/components/SettingsPanel.tsx:275`, `src/features/settings/components/SettingsPanel.tsx:392`.
- Rule application in tool forms: `src/pages/AddToolPage.tsx:173`, `src/pages/ToolDetailPage.tsx:424`.

## Remaining risks
- Overuse of custom overrides can reduce strictness if users consistently bypass presets.
- Additional combobox primitives may be needed if option counts increase significantly.
