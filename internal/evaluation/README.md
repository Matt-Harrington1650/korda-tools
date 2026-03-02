# Evaluation Evidence Policy

## Binding Decision
- `internal/evaluation/` is a committed evidence path.
- Files in this directory are retained for auditability and enterprise readiness provenance.
- PRs that add or update evaluation conclusions must update the related evidence files in this directory.
- Temporary personal notes must not be stored in this directory.

## Allowed Contents
- Evaluation reports (`*_report.md`)
- Comparison matrices and risk registers
- Readiness scorecards
- Deterministic evaluation harness tests (`*.test.ts`)

## Prohibited Contents
- Secrets, credentials, or production data exports
- One-off scratch files with no repeatable test value
- Generated binary artifacts

## Definition of Done
- Evaluation outputs referenced by governance/architecture decisions are committed under this directory.
- No placeholders or draft markers remain in committed evaluation files.
- Directory content is safe for source control review.

## Tests
1. `git status --short` shows tracked changes for `internal/evaluation/` when evaluation files are updated.
2. `rg -n "TODO|placeholder|TBD" internal/evaluation`
3. `rg -n "Definition of Done|Tests" internal/evaluation/README.md`
