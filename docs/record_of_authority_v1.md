# Record of Authority (v1)

## Artifact Authority Table
| Artifact Type | Source of Truth | Authoritative Format | Derived Allowed? |
|---|---|---|---|
| Issued Drawings | Final Issued PDF Set | PDF/A | Yes |
| Specs | Sealed Spec Book | PDF/A | Yes |
| Calculations | Signed Calc Package | PDF | No overwrite |
| RFIs | Issued RFI Log | PDF | Yes |
| Submittals | Approved Submittal | PDF | Yes |
| AI Output | Never authoritative | N/A | Advisory |
| Meeting Minutes | Approved Meeting Record | PDF | Yes |
| CA Field Reports | Issued CA Report | PDF | Yes |

## Lifecycle States
- Draft: Editable working state; not authoritative.
- Issued: Signed/released authoritative state; immutable.
- Superseded: Prior issued state retained for history; read-only.
- Archived: Retained under policy/legal hold; read-only and export-restricted.

## Rules Preventing AI from Becoming Record
- AI-generated content is always tagged `advisory` and cannot transition directly to `issued`.
- Only human-approved artifacts in authoritative formats (primarily PDF/A or required contract format) may become record.
- Finalization requires explicit actor approval, integrity hash capture, and audit append.
- Any AI-assisted draft must be re-issued through standard human approval workflow.
- System blocks `source_of_truth = AI` assignments at service and DB constraint layers.

## Definition of Done
- Authority table exists with all required rows and fields.
- Lifecycle states are explicitly defined and enforce immutable issued records.
- Rules explicitly prevent AI artifacts from becoming authoritative records.

## Tests
- Attempt to finalize AI output as authoritative record; verify operation is blocked.
- Finalize an approved human-reviewed record and verify status moves Draft -> Issued.
- Create superseding version and verify previous issued version remains immutable.
- Verify archival state prevents modification and enforces retention/export controls.