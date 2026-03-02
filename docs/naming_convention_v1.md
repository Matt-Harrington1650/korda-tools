# Naming Convention (v1)

## Filename Grammar
`{ProjectID}_{Discipline}_{DocType}_{Area}_{System}_{Rev}_{YYYYMMDD}_{Origin}_{Status}.ext`

## Field Rules
- `ProjectID`: uppercase letters/numbers, 3-12 chars (example: `TWR01`, `HCF02`).
- `Discipline`: reserved code (A, C, S, M, E, P, FP, LV, L, GEN).
- `DocType`: MUST be one of reserved DocType enums.
- `Area`: short zone/building token (B1, PODA, CORE, LVL12, CAMPUS).
- `System`: system token (HVAC, POWER, LIGHTING, FIREALARM, MEDGAS).
- `Rev`: `R00` to `R99`.
- `YYYYMMDD`: valid calendar date.
- `Origin`: `INT`, `EXT`, `CONS`, `VEND`, `CLNT`.
- `Status`: MUST be one of reserved Status enums.

## DocType enums
Reserved drawing DocType values:
- `PLAN`
- `SECTION`
- `ELEVATION`
- `DETAIL`
- `SCHEDULE`
- `SINGLELINE`
- `RISER`
- `DIAGRAM`

Reserved specification/contract DocType values:
- `SPEC`
- `ADDENDUM`
- `BULLETIN`
- `ASI`
- `BIDTAB`

Reserved CA/workflow DocType values:
- `RFI`
- `RFI_LOG`
- `SUBMITTAL`
- `SUBMITTAL_LOG`
- `PUNCHLIST`
- `FIELDREPORT`
- `SITEREPORT`
- `NCR`

Reserved engineering/support DocType values:
- `CALC`
- `LOADCALC`
- `SHORTCIRCUIT`
- `ARCFLASH`
- `COMMISSIONING`
- `MEETINGMIN`
- `EMAIL`
- `TRANSMITTAL`

## Reserved Status enums
- `Draft`
- `InternalReview`
- `IFP`
- `IFC`
- `Issued`
- `Superseded`
- `AsBuilt`
- `Record`
- `Voided`
- `Archived`

## Mandatory Fields by Artifact Type
- Drawings: ProjectID, Discipline, DocType, Area, System, Rev, Date, Origin, Status.
- Specs: ProjectID, Discipline (`GEN` allowed), DocType=`SPEC`, Area, Rev, Date, Origin, Status.
- RFIs: ProjectID, Discipline, DocType=`RFI` or `RFI_LOG`, Area, System (`GEN` allowed), Rev, Date, Origin, Status.
- Submittals: ProjectID, Discipline, DocType=`SUBMITTAL` or `SUBMITTAL_LOG`, Area, System, Rev, Date, Origin, Status.
- Calcs: ProjectID, Discipline, DocType in (`CALC`,`LOADCALC`,`SHORTCIRCUIT`,`ARCFLASH`), Area, System, Rev, Date, Origin, Status.
- Emails: ProjectID, Discipline (`GEN` allowed), DocType=`EMAIL`, Area (`GEN` allowed), System (`GEN`), Rev, Date, Origin, Status.
- Meeting Minutes: ProjectID, Discipline (`GEN` allowed), DocType=`MEETINGMIN`, Area, System (`GEN`), Rev, Date, Origin, Status.

## Upload Validation (Reject Rules)
KORDA rejects upload when:
- Filename does not match the 9-token grammar.
- `DocType` not in reserved DocType enums.
- `Status` not in reserved status enums.
- Date is invalid or future-dated beyond policy window.
- `Rev` missing or not `RNN` format.
- `ProjectID` does not match active project context.
- Disallowed extension for DocType (example: `RFI` with `.dwg`).
- Forbidden terms present: `final_final`, `vFinal`, `latest_latest`, `newnew`.

## Rules to Prevent "final_final_v7" Chaos
- Status must be explicit enum; free-text status suffixes are prohibited.
- Revision must be canonical `RNN`; `v1/v2/final/final2` are invalid.
- Superseded files remain in storage but must carry `Status=Superseded` and incremented revision.
- Re-issue always creates new filename with new revision/date, never overwrite.

## Examples (Valid)
1. `TWR01_E_PLAN_LVL12_POWER_R03_20270118_INT_IFC.pdf`
2. `TWR01_E_SINGLELINE_CORE_POWER_R01_20270110_INT_IFP.pdf`
3. `TWR01_M_PLAN_LVL15_HVAC_R04_20270212_CONS_Issued.pdf`
4. `TWR01_FP_RISER_CORE_FIREALARM_R02_20270201_CONS_IFC.pdf`
5. `TWR01_P_SCHEDULE_B2_MEDGAS_R00_20270105_CONS_Draft.xlsx`
6. `TWR01_GEN_SPEC_CAMPUS_GEN_R02_20270122_CONS_Issued.pdf`
7. `TWR01_GEN_ADDENDUM_CAMPUS_GEN_R01_20270125_INT_Issued.pdf`
8. `TWR01_E_RFI_LVL08_LIGHTING_R00_20270214_CLNT_Issued.pdf`
9. `TWR01_M_RFI_LOG_CAMPUS_HVAC_R05_20270301_INT_Issued.xlsx`
10. `TWR01_E_SUBMITTAL_LVL12_POWER_R02_20270304_VEND_InternalReview.pdf`
11. `TWR01_FP_SUBMITTAL_LOG_CORE_FIREALARM_R03_20270308_INT_Issued.xlsx`
12. `TWR01_E_CALC_CORE_POWER_R01_20270109_CONS_Draft.xlsx`
13. `TWR01_E_SHORTCIRCUIT_CORE_POWER_R00_20270111_CONS_InternalReview.xlsx`
14. `TWR01_E_ARCFLASH_CORE_POWER_R00_20270115_CONS_InternalReview.xlsx`
15. `TWR01_GEN_MEETINGMIN_CAMPUS_GEN_R06_20270320_INT_Issued.pdf`
16. `TWR01_GEN_EMAIL_CAMPUS_GEN_R00_20270319_EXT_Record.msg`
17. `HCF02_M_PLAN_PODA_HVAC_R02_20270411_CONS_IFP.pdf`
18. `HCF02_E_DIAGRAM_PODB_NORMALPOWER_R01_20270414_CONS_IFC.pdf`
19. `HCF02_P_LOADCALC_PODA_DOMWATER_R01_20270403_CONS_Issued.xlsx`
20. `HCF02_GEN_TRANSMITTAL_CAMPUS_GEN_R03_20270420_INT_Issued.pdf`

## Definition of Done
- Filename grammar is explicit and machine-parseable.
- Reserved DocType enums include at least 25 values.
- Reserved status enums are defined and enforced.
- Mandatory fields by artifact type are documented.
- At least 20 valid examples are provided.

## Tests
- `rg -n "DocType enums|final_final|Reserved Status enums|Filename Grammar" docs/naming_convention_v1.md`
- Manual: attempt upload with `*_final_final_v7_*` and verify hard reject.
- Manual: upload one valid sample per artifact type and verify accept.
- Manual: upload with invalid date or revision format and verify reject.