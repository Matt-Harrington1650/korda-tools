# Input Conversion Decision Matrix v1

## Executive findings
- Decision model applied: finite-domain values default to structured controls; open-ended authored content remains freeform.
- Conversion work prioritized SOPHON ingestion/tuning/settings plus cross-product tool/workflow configuration surfaces.
- Custom override pattern is used where strict enum-only behavior would block legitimate use cases.

## Severity-ranked findings
- P1: Previous category/header/interval fields depended on manual typing and were error-prone.
- P2: Some custom override paths still require freeform for flexibility.
- P3: Remaining freeform search/query fields are intentional and aligned with workflow intent.

| Field ID | Keep or Convert | Why | Replacement Control | Backend Impact | UX Risk | Evidence |
|---|---|---|---|---|---|---|
| IN-001 | CONVERT | Category is mostly finite in normal workflows | Dropdown + custom override | None (still string persisted) | Low | `src/pages/AddToolPage.tsx:173` |
| IN-002 | CONVERT | Header names are usually finite; custom still possible | Dropdown + custom override | None | Low | `src/pages/AddToolPage.tsx:235` |
| IN-003 | CONVERT | Same as Add Tool category | Dropdown + custom override | None | Low | `src/pages/ToolDetailPage.tsx:424` |
| IN-004 | CONVERT | Same as Add Tool custom header | Dropdown + custom override | None | Low | `src/pages/ToolDetailPage.tsx:484` |
| IN-005 | CONVERT | Custom tool categories are finite for most users | Dropdown + custom override | None | Low | `src/pages/AddCustomToolPage.tsx:251` |
| IN-006 | CONVERT | Interval is bounded numeric with common presets | Preset dropdown + custom number | None (`Number()` parse remains) | Low | `src/pages/WorkflowsPage.tsx:604` |
| IN-007 | CONVERT | Help categories are enumerable from existing pages | Dropdown + custom override | None | Low | `src/pages/HelpCenterPage.tsx:558` |
| IN-008 | KEEP_FREEFORM | Path values are machine-specific and non-enumerable | Freeform + datalist suggestions | None | Medium | `src/pages/sophon/SophonSourcesPage.tsx:172` |
| IN-009 | CONVERT | Supported file types are finite | Checkbox group | None | Low | `src/pages/sophon/SophonSourcesPage.tsx:191` |
| IN-010 | CONVERT | Source type is finite enum | Segmented control | None | Low | `src/pages/sophon/SophonSourcesPage.tsx:139` |
| IN-011 | CONVERT | Scan depth is finite enum | Segmented control | None | Low | `src/pages/sophon/SophonSourcesPage.tsx:149` |
| IN-012 | CONVERT | Sensitivity is finite enum | Dropdown | None | Low | `src/pages/sophon/SophonSourcesPage.tsx:227` |
| IN-013 | CONVERT | Embedding model selection should be constrained | Dropdown (+ current custom option) | None | Low | `src/pages/sophon/SophonModelsTuningPage.tsx:27` |
| IN-014 | CONVERT | Top-K is bounded finite set | Dropdown | None | Low | `src/pages/sophon/SophonModelsTuningPage.tsx:43` |
| IN-015 | CONVERT | Threshold is bounded 0..1 numeric | Slider | None | Low | `src/pages/sophon/SophonModelsTuningPage.tsx:59` |
| IN-016 | CONVERT | Threshold is bounded 0..1 numeric | Slider | None | Low | `src/pages/sophon/SophonModelsTuningPage.tsx:74` |
| IN-017 | CONVERT | Context window uses known operational presets | Dropdown | None | Low | `src/pages/sophon/SophonModelsTuningPage.tsx:89` |
| IN-018 | CONVERT | Response max token uses known presets | Dropdown | None | Low | `src/pages/sophon/SophonModelsTuningPage.tsx:105` |
| IN-019 | CONVERT | Worker count should be stepped/bounded | Dropdown | None | Low | `src/pages/sophon/SophonModelsTuningPage.tsx:121` |
| IN-020 | CONVERT | Snapshot naming commonly preset-based | Naming mode dropdown + custom input | None | Low | `src/pages/sophon/SophonIndexPage.tsx:73` |
| IN-021 | KEEP_FREEFORM | User-authored prompt is core intent | Textarea | None | High if over-constrained | `src/pages/ChatPage.tsx:384` |
| IN-022 | KEEP_FREEFORM | Query text is genuinely open-ended | Text input | None | High if over-constrained | `src/pages/sophon/SophonRetrievalLabPage.tsx:68` |
| IN-023 | KEEP_FREEFORM | Search must allow arbitrary phrase matching | Text input | None | High if over-constrained | `src/pages/HelpCenterPage.tsx:366` |
| IN-024 | KEEP_FREEFORM | Endpoint URLs/payloads are integration-specific | Text + textarea | None | High if over-constrained | `src/plugins/ui/BuiltinConfigPanels.tsx:129` |

## Re-test results
- Typecheck: pass.
- Lint: pass (2 existing warnings).
- Tests: pass (92/92).
- Build: pass.

## Remaining risks
- Some “custom override” inputs still permit arbitrary values; server-side/schema validation remains the final guardrail.
