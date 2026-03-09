# Remaining Freeform Fields Justification

## Executive findings
- Freeform inputs were retained only where value domains are genuinely open-ended or picker APIs are unavailable.
- No finite enum/boolean/stepped field was intentionally left as plain text in the converted SOPHON/settings/tool targets.

## Severity-ranked findings
- P1: None.
- P2: SOPHON source path still freeform due runtime picker limitations.
- P3: Several integration/search/editor fields remain freeform by design.

| Field ID | Surface | File | Field | Why Freeform Remains | Risk | Evidence |
|---|---|---|---|---|---|---|
| RF-001 | SOPHON Sources | src/pages/sophon/SophonSourcesPage.tsx | Path | Cross-target runtime currently lacks reliable absolute picker path support | Medium | `src/pages/sophon/SophonSourcesPage.tsx:172`, `src/pages/sophon/SophonSourcesPage.tsx:188` |
| RF-002 | Chat | src/pages/ChatPage.tsx | Message / payload | User-authored prompts are open-ended | Low | `src/pages/ChatPage.tsx:384` |
| RF-003 | SOPHON Retrieval Lab | src/pages/sophon/SophonRetrievalLabPage.tsx | Query input | Query language is open-ended by design | Low | `src/pages/sophon/SophonRetrievalLabPage.tsx:68` |
| RF-004 | SOPHON Policies | src/pages/sophon/SophonPoliciesAuditPage.tsx | Audit filter | Arbitrary substring filtering | Low | `src/pages/sophon/SophonPoliciesAuditPage.tsx:75` |
| RF-005 | Help Center | src/pages/HelpCenterPage.tsx | Global/in-page search | Full text search requires freeform | Low | `src/pages/HelpCenterPage.tsx:366`, `src/pages/HelpCenterPage.tsx:502` |
| RF-006 | Help Center Editor | src/pages/HelpCenterPage.tsx | Markdown content | Longform authored content | Low | `src/pages/HelpCenterPage.tsx:570` |
| RF-007 | Plugin Config Panels | src/plugins/ui/BuiltinConfigPanels.tsx | Endpoint URL | Integration targets are open domain | Medium | `src/plugins/ui/BuiltinConfigPanels.tsx:129`, `src/plugins/ui/BuiltinConfigPanels.tsx:184`, `src/plugins/ui/BuiltinConfigPanels.tsx:221` |
| RF-008 | Plugin Config Panels | src/plugins/ui/BuiltinConfigPanels.tsx | Header rows (key/value) | Arbitrary provider headers | Medium | `src/plugins/ui/BuiltinConfigPanels.tsx:64`, `src/plugins/ui/BuiltinConfigPanels.tsx:78` |
| RF-009 | Plugin Config Panels | src/plugins/ui/BuiltinConfigPanels.tsx | Sample payload | Open-ended JSON/body content | Low | `src/plugins/ui/BuiltinConfigPanels.tsx:162`, `src/plugins/ui/BuiltinConfigPanels.tsx:199` |
| RF-010 | Governance/records/admin | src/pages/RecordsGovernancePage.tsx | Actor/provider/reason IDs | Governance IDs and rationale text are open domain | Medium | `src/pages/RecordsGovernancePage.tsx:470`, `src/pages/RecordsGovernancePage.tsx:518`, `src/pages/RecordsGovernancePage.tsx:550` |

## Re-test results
- No schema/type regressions from retained freeform fields.
- Full automated checks pass after structured-input conversion patch set.

## Remaining risks
- Freeform endpoint/header/payload inputs can still produce invalid external integrations; existing validation remains required.
- Path field should be revisited when a stable desktop folder/file picker path API is available.
