# Minimum Metadata Schema (v1)

## Scope
This schema defines the minimum metadata needed for human usability fallback and KORDA ingestion automation.

## Field Matrix
| Field | Type | Required? | Source | Validation | Default Behavior |
|---|---|---|---|---|---|
| `project_id` | `string` | Y | user-provided | Must match active project registry key | Reject upload if missing/mismatch |
| `artifact_type` | `enum` | Y | user-provided | Must be allowed type (`drawing`,`spec`,`rfi`,`submittal`,`calc`,`email`,`meeting_minute`,`ca_report`) | Reject upload if unknown |
| `discipline` | `enum` | Y | user-provided | Must be in discipline codes (`A`,`C`,`S`,`M`,`E`,`P`,`FP`,`LV`,`L`,`GEN`) | Reject upload if unknown |
| `status` | `enum` | Y | user-provided | Must map to naming status enum | Reject upload if invalid |
| `sensitivity_level` | `enum` | Y | user-provided | Must be one of (`Public`,`Internal`,`Confidential`,`Client-Confidential`) | Reject upload if missing |
| `revision` | `string` | N | extracted | Pattern `R[0-9]{2}` from filename/content; confidence tracked | Set `R00` with extraction flag `low_confidence` |
| `date` | `date` (`YYYY-MM-DD`) | N | extracted | Parse from filename/content; cannot be impossible date | Default to ingestion date with `derived_from_ingest=true` |
| `sheet_number` | `string` | N | extracted | Pattern by discipline (`E-###`, `M-###`, etc.) | Null if not present |
| `voltage_class` | `enum` | N | extracted | Allowed (`ELV`,`LV`,`MV`,`HV`,`N/A`) | `N/A` for non-electrical artifacts |
| `system_category` | `enum` | N | derived | Derived mapping from artifact_type + discipline + keywords | `GENERIC` when derivation uncertain |
| `confidence_score` | `number` (0.00-1.00) | N | derived | Decimal range inclusive; computed from extraction/derivation quality | `0.50` baseline when no extractor signal |

## Required At Upload
The uploader must require and persist before blob commit:
- `project_id`
- `artifact_type`
- `discipline`
- `status`
- `sensitivity_level`

## Extracted Fields
Extracted during ingestion parsing:
- `revision`
- `date`
- `sheet_number`
- `voltage_class`

## Derived Fields
Derived by rules engine/ML classifier:
- `system_category`
- `confidence_score`

## DB Impact
Minimum relational structures that must exist:

### Required columns on `artifacts` table
- `project_id TEXT NOT NULL`
- `artifact_type TEXT NOT NULL`
- `discipline TEXT NOT NULL`
- `status TEXT NOT NULL`
- `sensitivity_level TEXT NOT NULL`
- `revision TEXT NULL`
- `document_date TEXT NULL`
- `sheet_number TEXT NULL`
- `voltage_class TEXT NULL`
- `system_category TEXT NULL`
- `confidence_score REAL NULL`

### Required constraints
- CHECK constraint on `sensitivity_level` enum values.
- CHECK constraint on `confidence_score` between `0.0` and `1.0`.
- FK from `project_id` to `projects.id`.

### Suggested support tables
- `metadata_extraction_events` (artifact_id, extractor_version, field, confidence, extracted_at_utc)
- `metadata_overrides` (artifact_id, field, old_value, new_value, actor_id, reason, changed_at_utc)

## Definition of Done
- Required upload fields are explicitly defined and validated.
- Extracted and derived fields are explicitly typed with source and default behavior.
- `sensitivity_level` and `voltage_class` are included with enforceable validation.
- DB impact section defines required columns, constraints, and support tables.

## Tests
- `rg -n "sensitivity_level|voltage_class|DB Impact|Required At Upload" docs/minimum_metadata_schema_v1.md`
- Unit: reject upload when any required upload field is missing.
- Unit: enforce enum validation for `artifact_type`, `discipline`, `status`, `sensitivity_level`.
- Unit: enforce `confidence_score` numeric range validation.
- Manual: ingest mixed files and verify extracted fields populate with expected defaults when missing.