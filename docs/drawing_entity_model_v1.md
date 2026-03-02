# Drawing Entity Model (v1)

## 1) Entity Model
`Project -> Package -> Sheet -> Detail -> Callout -> Reference`

Model intent:
- Project is the legal and governance boundary.
- Package groups issued drawing sets (IFP/IFC/Addendum/As-Built).
- Sheet is the primary record unit for drawing intelligence.
- Detail and Callout are structured derived entities from sheets.
- Reference links callouts/details/sheets to related records.

## 2) Entity Definitions

### Project
Identifiers:
- `project_id` (TEXT, globally unique)

Key fields:
- `project_id`
- `workspace_id`
- `project_name`
- `status`
- `created_at_utc`

Relationships:
- One Project has many Packages.
- One Project has many Sheets (through Packages).
- One Project owns all sheet links and outcome signals.

### Package
Identifiers:
- `package_id` (TEXT, unique)

Key fields:
- `package_id`
- `project_id`
- `package_type` (`IFP`, `IFC`, `Addendum`, `AsBuilt`)
- `package_number`
- `issued_at_utc`
- `issued_by`
- `status`

Relationships:
- Each Package belongs to one Project.
- Each Package contains many Sheets.

### Sheet
Identifiers:
- `sheet_id` (TEXT, unique)
- Natural key candidate: (`project_id`, `sheet_number`, `revision`, `issue_date`)

Key fields:
- `sheet_id`
- `project_id`
- `package_id`
- `artifact_id`
- `sheet_number`
- `title`
- `discipline`
- `revision`
- `issue_date`
- `sheet_status`
- `authoritative_format`
- `ocr_confidence`

Relationships:
- Each Sheet belongs to one Package and one Project.
- Each Sheet has many Details.
- Each Sheet has many Callouts.
- Each Sheet may reference many other Sheets through sheet_references.
- Each Sheet may link to many RFIs/Submittals/Outcome signals.

### Detail
Identifiers:
- `detail_id` (TEXT, unique)

Key fields:
- `detail_id`
- `sheet_id`
- `detail_tag`
- `bbox_json`
- `detail_title`
- `confidence_score`

Relationships:
- Each Detail belongs to one Sheet.
- One Detail may have many Callouts.

### Callout
Identifiers:
- `callout_id` (TEXT, unique)

Key fields:
- `callout_id`
- `sheet_id`
- `detail_id` (nullable)
- `callout_text`
- `callout_type`
- `bbox_json`
- `confidence_score`

Relationships:
- Each Callout belongs to one Sheet.
- Callout may point to one Detail.
- Callout participates in Reference links.

### Reference
Identifiers:
- `reference_id` (TEXT, unique)

Key fields:
- `reference_id`
- `source_sheet_id`
- `source_callout_id` (nullable)
- `target_ref_type` (`sheet`, `detail`, `rfi`, `submittal`, `spec`)
- `target_ref_id`
- `link_confidence`
- `created_at_utc`

Relationships:
- One Reference links source entities to target entities.
- References are derived and never replace authoritative package/sheet records.

## 3) Relational Mapping Tables To Add

### `sheets`
Columns + types:
- `id TEXT PRIMARY KEY`
- `project_id TEXT NOT NULL`
- `package_id TEXT NOT NULL`
- `artifact_id TEXT NOT NULL`
- `sheet_number TEXT NOT NULL`
- `title TEXT NOT NULL`
- `discipline TEXT NOT NULL`
- `revision TEXT NOT NULL`
- `issue_date TEXT NOT NULL`
- `sheet_status TEXT NOT NULL`
- `authoritative_format TEXT NOT NULL DEFAULT 'PDF/A'`
- `ocr_confidence REAL`
- `created_at_utc TEXT NOT NULL`

Primary key:
- `id`

Foreign keys:
- `project_id -> projects(id)`
- `package_id -> deliverables(id)` (or package table when implemented)
- `artifact_id -> artifacts(id)`

Indexes:
- `idx_sheets_project_sheet_number` on `(project_id, sheet_number)`
- `idx_sheets_project_revision_issue_date` on `(project_id, revision, issue_date)`
- `idx_sheets_package` on `(package_id)`

### `sheet_references`
Columns + types:
- `id TEXT PRIMARY KEY`
- `project_id TEXT NOT NULL`
- `source_sheet_id TEXT NOT NULL`
- `target_sheet_id TEXT`
- `target_ref_type TEXT NOT NULL`
- `target_ref_id TEXT NOT NULL`
- `source_callout_text TEXT`
- `confidence_score REAL`
- `created_at_utc TEXT NOT NULL`

Primary key:
- `id`

Foreign keys:
- `project_id -> projects(id)`
- `source_sheet_id -> sheets(id)`
- `target_sheet_id -> sheets(id)` (nullable)

Indexes:
- `idx_sheet_references_source` on `(source_sheet_id)`
- `idx_sheet_references_target` on `(target_ref_type, target_ref_id)`
- `idx_sheet_references_project` on `(project_id, created_at_utc)`

### `sheet_rfi_links`
Columns + types:
- `id TEXT PRIMARY KEY`
- `project_id TEXT NOT NULL`
- `sheet_id TEXT NOT NULL`
- `rfi_id TEXT NOT NULL`
- `link_type TEXT NOT NULL` (`mentioned_on`, `impacts`, `resolved_by`)
- `confidence_score REAL`
- `created_at_utc TEXT NOT NULL`
- `created_by TEXT NOT NULL`

Primary key:
- `id`

Foreign keys:
- `project_id -> projects(id)`
- `sheet_id -> sheets(id)`
- `rfi_id -> artifacts(id)` (or dedicated RFI table when introduced)

Indexes:
- `idx_sheet_rfi_links_sheet` on `(sheet_id)`
- `idx_sheet_rfi_links_rfi` on `(rfi_id)`
- `idx_sheet_rfi_links_project` on `(project_id, created_at_utc)`

### `sheet_submittal_links`
Columns + types:
- `id TEXT PRIMARY KEY`
- `project_id TEXT NOT NULL`
- `sheet_id TEXT NOT NULL`
- `submittal_id TEXT NOT NULL`
- `link_type TEXT NOT NULL` (`required_by`, `satisfied_by`, `deviates_from`)
- `confidence_score REAL`
- `created_at_utc TEXT NOT NULL`
- `created_by TEXT NOT NULL`

Primary key:
- `id`

Foreign keys:
- `project_id -> projects(id)`
- `sheet_id -> sheets(id)`
- `submittal_id -> artifacts(id)` (or dedicated submittal table when introduced)

Indexes:
- `idx_sheet_submittal_links_sheet` on `(sheet_id)`
- `idx_sheet_submittal_links_submittal` on `(submittal_id)`
- `idx_sheet_submittal_links_project` on `(project_id, created_at_utc)`

### `sheet_outcome_signals`
Columns + types:
- `id TEXT PRIMARY KEY`
- `project_id TEXT NOT NULL`
- `sheet_id TEXT NOT NULL`
- `signal_type TEXT NOT NULL` (`coordination_risk`, `field_conflict`, `late_change`, `quality_flag`)
- `severity TEXT NOT NULL` (`low`, `medium`, `high`, `critical`)
- `score REAL NOT NULL`
- `source TEXT NOT NULL` (`rule`, `ml`, `manual`)
- `explanation TEXT`
- `created_at_utc TEXT NOT NULL`

Primary key:
- `id`

Foreign keys:
- `project_id -> projects(id)`
- `sheet_id -> sheets(id)`

Indexes:
- `idx_sheet_outcome_signals_sheet` on `(sheet_id, severity)`
- `idx_sheet_outcome_signals_project_type` on `(project_id, signal_type, created_at_utc)`

## 4) Extraction Accuracy Expectations

| Field | Best | Typical | Worst |
|---|---:|---:|---:|
| Sheet Number | 99% | 95% | 80% |
| Discipline | 98% | 90% | 75% |
| Revision | 95% | 85% | 60% |

Notes:
- OCR quality is the dominant cost driver for extraction quality and QA effort.
- Derived data is not authoritative record; issued PDF/A package remains source-of-truth.
- Legal caution: extracted/derived fields are advisory unless validated against authoritative issued records.

## 5) Migration Strategy for Pilot

Pilot scope:
- Pilot equals 3 projects.

Execution steps:
1. Extract sheets from issued packages for each pilot project.
2. Create `sheets` rows with deterministic identifiers and hash-linked artifact references.
3. Extract references and populate `sheet_references`.
4. Link known RFIs into `sheet_rfi_links` and known submittals into `sheet_submittal_links`.
5. Populate `sheet_outcome_signals` from initial rule-based signals.
6. Validate integrity: FK consistency, duplicate checks, and hash-to-artifact traceability.
7. Run QA sampling on extracted fields and link accuracy.

Scaling criteria:
- Accuracy thresholds met on pilot set:
- Sheet Number >= 95% typical
- Discipline >= 90% typical
- Revision >= 85% typical
- QA workflow in place:
- Human review queue for low-confidence extractions.
- Correction audit trail for every manual override.
- Re-processing runbook documented for model or parser upgrades.

## Definition of Done
- Entity model is fully defined from Project through Reference.
- Table specs for `sheets`, `sheet_references`, `sheet_rfi_links`, `sheet_submittal_links`, and `sheet_outcome_signals` are complete with columns/types/PK/FK/indexes.
- Accuracy expectation table and legal caution notes are documented.
- Pilot migration strategy includes scope, steps, and scaling criteria.

## Tests
- `rg -n "sheets|sheet_references|accuracy|pilot" docs/drawing_entity_model_v1.md`
- Validate each table section includes: columns/types, primary key, foreign keys, indexes.
- Validate pilot section explicitly states 3 projects and includes accuracy thresholds + QA workflow.