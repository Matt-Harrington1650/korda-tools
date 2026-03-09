# Structured Input Inventory Matrix

## Executive findings
- Canonical host repo is `C:\code\ai-tool-hub` (active SOPHON + latest UI work).
- Bounded text fields in SOPHON sources/tuning/index and global settings were already converted in the current branch state.
- Additional bounded text fields were converted in this pass: tool category selection, custom-header selection, workflow interval scheduling, and help-page category selection.
- Remaining freeform fields are concentrated in user-authored content, IDs/URLs, markdown bodies, and query/search inputs.
- Full automated regression suite passed after changes (`typecheck`, `lint`, `test`, `build`).

## Severity-ranked findings
- P1: Several bounded fields were still text-entry in tool and workflow surfaces before this pass.
- P2: Some surfaces still require freeform due genuinely open domain or lack of robust picker APIs across targets.
- P3: React compiler warnings from `react-hook-form watch()` remain unchanged and non-blocking.

| Field ID | Surface | File | Label/Placeholder | Current Control | Value Domain | Proposed Replacement | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| IN-001 | Add Tool | src/pages/AddToolPage.tsx | Category | Select + custom override | Finite + optional custom | Dropdown + custom input | Converted | `src/pages/AddToolPage.tsx:173`, `src/pages/AddToolPage.tsx:182` |
| IN-002 | Add Tool | src/pages/AddToolPage.tsx | Custom Header Name | Select + custom override | Finite + optional custom | Dropdown + custom input | Converted | `src/pages/AddToolPage.tsx:235`, `src/pages/AddToolPage.tsx:244` |
| IN-003 | Edit Tool | src/pages/ToolDetailPage.tsx | Category | Select + custom override | Finite + optional custom | Dropdown + custom input | Converted | `src/pages/ToolDetailPage.tsx:424`, `src/pages/ToolDetailPage.tsx:433` |
| IN-004 | Edit Tool | src/pages/ToolDetailPage.tsx | Custom Header Name | Select + custom override | Finite + optional custom | Dropdown + custom input | Converted | `src/pages/ToolDetailPage.tsx:484`, `src/pages/ToolDetailPage.tsx:493` |
| IN-005 | Add Custom Tool | src/pages/AddCustomToolPage.tsx | Category | Select + custom override | Finite + optional custom | Dropdown + custom input | Converted | `src/pages/AddCustomToolPage.tsx:251`, `src/pages/AddCustomToolPage.tsx:260` |
| IN-006 | Workflows | src/pages/WorkflowsPage.tsx | Schedule Interval Minutes | Preset select + custom number | Finite presets + optional custom | Dropdown + number stepper | Converted | `src/pages/WorkflowsPage.tsx:604`, `src/pages/WorkflowsPage.tsx:613` |
| IN-007 | Help Center Editor | src/pages/HelpCenterPage.tsx | Category | Select + custom override | Finite + optional custom | Dropdown + custom input | Converted | `src/pages/HelpCenterPage.tsx:558`, `src/pages/HelpCenterPage.tsx:567` |
| IN-008 | SOPHON Sources | src/pages/sophon/SophonSourcesPage.tsx | Allowed File Types | Checkbox group | Finite multiselect | Checkbox group | Converted | `src/pages/sophon/SophonSourcesPage.tsx:191` |
| IN-009 | SOPHON Sources | src/pages/sophon/SophonSourcesPage.tsx | Source Type | Segmented control | Finite enum | Segmented control | Converted | `src/pages/sophon/SophonSourcesPage.tsx:139` |
| IN-010 | SOPHON Sources | src/pages/sophon/SophonSourcesPage.tsx | Scan Depth | Segmented control | Finite enum | Segmented control | Converted | `src/pages/sophon/SophonSourcesPage.tsx:149` |
| IN-011 | SOPHON Sources | src/pages/sophon/SophonSourcesPage.tsx | Sensitivity | Dropdown | Finite enum | Dropdown | Converted | `src/pages/sophon/SophonSourcesPage.tsx:227` |
| IN-012 | SOPHON Sources | src/pages/sophon/SophonSourcesPage.tsx | Path | Text input | Open path target per machine | Keep freeform (with suggestions) | Kept freeform | `src/pages/sophon/SophonSourcesPage.tsx:172`, `src/pages/sophon/SophonSourcesPage.tsx:188` |
| IN-013 | SOPHON Models | src/pages/sophon/SophonModelsTuningPage.tsx | Embedding Model | Dropdown | Finite + current fallback | Dropdown | Converted | `src/pages/sophon/SophonModelsTuningPage.tsx:27` |
| IN-014 | SOPHON Models | src/pages/sophon/SophonModelsTuningPage.tsx | Retriever Top-K | Dropdown | Finite numeric enum | Dropdown | Converted | `src/pages/sophon/SophonModelsTuningPage.tsx:43` |
| IN-015 | SOPHON Models | src/pages/sophon/SophonModelsTuningPage.tsx | Score Threshold | Range slider | Bounded numeric | Slider | Converted | `src/pages/sophon/SophonModelsTuningPage.tsx:59` |
| IN-016 | SOPHON Models | src/pages/sophon/SophonModelsTuningPage.tsx | Reranker Threshold | Range slider | Bounded numeric | Slider | Converted | `src/pages/sophon/SophonModelsTuningPage.tsx:74` |
| IN-017 | SOPHON Models | src/pages/sophon/SophonModelsTuningPage.tsx | Context Window Tokens | Dropdown | Finite numeric enum | Dropdown | Converted | `src/pages/sophon/SophonModelsTuningPage.tsx:89` |
| IN-018 | SOPHON Models | src/pages/sophon/SophonModelsTuningPage.tsx | Response Max Tokens | Dropdown | Finite numeric enum | Dropdown | Converted | `src/pages/sophon/SophonModelsTuningPage.tsx:105` |
| IN-019 | SOPHON Models | src/pages/sophon/SophonModelsTuningPage.tsx | Max Ingestion Workers | Dropdown | Finite numeric enum | Dropdown | Converted | `src/pages/sophon/SophonModelsTuningPage.tsx:121` |
| IN-020 | SOPHON Index | src/pages/sophon/SophonIndexPage.tsx | Snapshot name | Naming mode + optional custom text | Preset + optional custom | Dropdown + conditional custom input | Converted | `src/pages/sophon/SophonIndexPage.tsx:73`, `src/pages/sophon/SophonIndexPage.tsx:87` |
| IN-021 | Settings | src/features/settings/components/SettingsPanel.tsx | Default Timeout | Preset dropdown + custom number | Finite + optional custom | Dropdown + number | Converted | `src/features/settings/components/SettingsPanel.tsx:275`, `src/features/settings/components/SettingsPanel.tsx:294` |
| IN-022 | Settings | src/features/settings/components/SettingsPanel.tsx | Local Storage Path | Preset dropdown + custom text | Finite + optional custom | Dropdown + custom input | Converted | `src/features/settings/components/SettingsPanel.tsx:307`, `src/features/settings/components/SettingsPanel.tsx:326` |
| IN-023 | Settings | src/features/settings/components/SettingsPanel.tsx | OpenAI Base URL | Preset dropdown + custom text | Finite + optional custom | Dropdown + custom input | Converted | `src/features/settings/components/SettingsPanel.tsx:335`, `src/features/settings/components/SettingsPanel.tsx:354` |
| IN-024 | Settings | src/features/settings/components/SettingsPanel.tsx | Default Model | Preset dropdown + custom text | Finite + optional custom | Dropdown + custom input | Converted | `src/features/settings/components/SettingsPanel.tsx:361`, `src/features/settings/components/SettingsPanel.tsx:380` |
| IN-025 | Settings | src/features/settings/components/SettingsPanel.tsx | Credential refs | Dropdown + custom text | Finite + optional custom | Dropdown + custom input | Converted | `src/features/settings/components/SettingsPanel.tsx:392`, `src/features/settings/components/SettingsPanel.tsx:411` |
| IN-026 | Chat | src/pages/ChatPage.tsx | Message / payload | Textarea | Open-ended authored prompt | Keep freeform | Kept freeform | `src/pages/ChatPage.tsx:384` |
| IN-027 | SOPHON Retrieval Lab | src/pages/sophon/SophonRetrievalLabPage.tsx | Ask question | Text input | Open-ended query | Keep freeform | Kept freeform | `src/pages/sophon/SophonRetrievalLabPage.tsx:68` |
| IN-028 | SOPHON Policies | src/pages/sophon/SophonPoliciesAuditPage.tsx | Audit filter | Text input | Open-ended filter token | Keep freeform | Kept freeform | `src/pages/sophon/SophonPoliciesAuditPage.tsx:75` |
| IN-029 | Help Center | src/pages/HelpCenterPage.tsx | Global search / in-page search | Text inputs | Open-ended search | Keep freeform | Kept freeform | `src/pages/HelpCenterPage.tsx:366`, `src/pages/HelpCenterPage.tsx:502` |
| IN-030 | Plugin Config | src/plugins/ui/BuiltinConfigPanels.tsx | Endpoint URL, headers, sample payload | Text/textarea | Open-ended integration payloads | Keep freeform | Kept freeform | `src/plugins/ui/BuiltinConfigPanels.tsx:129`, `src/plugins/ui/BuiltinConfigPanels.tsx:162` |

## Re-test summary
- `npm run typecheck`: pass.
- `npm run lint`: pass with 2 existing warnings only.
- `npm run test`: pass (32 files, 92 tests).
- `npm run build`: pass.

## Remaining risks
- Manual click-through validation for every converted surface remains pending in this non-interactive terminal run.
- A small set of custom override paths remain text-based by design; these are documented in `remaining_freeform_fields_justification.md`.
