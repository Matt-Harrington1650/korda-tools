# Sophon Backend Assertions

## Preconditions
- Runtime bridge initializes (`bridge_init=pass` in readiness or equivalent runtime-ready evidence).
- At least one source exists for `sophon_test_knowledge.md`.
- Ingestion job for this source reaches terminal status.
- Index state contains non-zero docs/chunks after successful ingestion.

## Query Assertions

### BA-01
- Query: building service rating and voltage
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Service and Distribution`
- Retrieval minimum: passage includes `4000 A` and `480Y/277 V`
- Refusal behavior: not applicable

### BA-02
- Query: ESB-1 rating
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Service and Distribution` or `Equipment Schedule`
- Retrieval minimum: `ESB-1` and `1200 A`
- Refusal behavior: not applicable

### BA-03
- Query: life safety ATS
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Service and Distribution` or `Equipment Schedule`
- Retrieval minimum: `ATS-LS-1`
- Refusal behavior: not applicable

### BA-04
- Query: generator runtime basis
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Generator and Emergency Power`
- Retrieval minimum: `24 hours`
- Refusal behavior: not applicable

### BA-05
- Query: lobby decorative lighting load allowance
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Lighting Criteria` or `Revision Note`
- Retrieval minimum: `1.8 W/sf`
- Refusal behavior: not applicable

### BA-06
- Query: Revision A open office target change
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Revision Note`
- Retrieval minimum: explicit statement that open office target did not change
- Refusal behavior: not applicable

### BA-07
- Query: panel for level 2 emergency lighting
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Panelboards`
- Retrieval minimum: `EH-2`
- Refusal behavior: not applicable

### BA-08
- Query: generator manufacturer
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Known Exclusions`
- Retrieval minimum: unsupported statement grounded to exclusion
- Refusal behavior: must not fabricate manufacturer

### BA-09
- Query: conduit size feeds MSB-1
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Known Exclusions`
- Retrieval minimum: unsupported statement grounded to exclusion
- Refusal behavior: must not fabricate conduit size

### BA-10
- Query: generator serves/does not serve summary
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Generator and Emergency Power`
- Retrieval minimum: includes served classes and explicit HVAC exclusion
- Refusal behavior: must not add extra loads

### BA-11
- Query: short-circuit current values
- Expected source: `sophon_test_knowledge.md`
- Expected section: `Known Exclusions`
- Retrieval minimum: unsupported statement grounded to exclusion
- Refusal behavior: must not fabricate current values

## State Assertions
- After ingestion success:
  - source exists in `sources` with matching path.
  - at least one job has `status=completed` for that source.
  - `index.docCount >= 1`.
  - `index.chunkCount >= 1`.
- After retrieval calls:
  - `lastRetrieval` object exists.
  - `lastRetrieval.query` equals the requested query.
  - `lastRetrieval.answer` is non-empty.
