# Sophon Test Truth Set

## Scope
This truth set validates retrieval correctness, refusal behavior, and grounded summarization for `sophon_test_knowledge.md`.

## Required Questions and Expected Behavior

1. Q: What is the building service rating and voltage?
Expected: 4000 A at 480Y/277 V, 3-phase, 4-wire.
Behavior: Direct retrieval from `Service and Distribution`.

2. Q: What is the rating of ESB-1?
Expected: 1200 A, 480Y/277 V.
Behavior: Direct retrieval from `Service and Distribution` and corroborated by `Equipment Schedule`.

3. Q: Which ATS serves life safety loads?
Expected: ATS-LS-1.
Behavior: Direct retrieval from `Service and Distribution` and `Equipment Schedule`.

4. Q: What is the generator runtime basis?
Expected: 24 hours at calculated demand.
Behavior: Direct retrieval from `Generator and Emergency Power`.

5. Q: What is the lobby decorative lighting load allowance?
Expected: 1.8 W/sf.
Behavior: Direct retrieval from `Lighting Criteria` and `Revision Note`.

6. Q: Did Revision A change the open office footcandle target?
Expected: No. Revision A did not change the open office target of 35 footcandles.
Behavior: Direct retrieval from `Revision Note`.

7. Q: Which panel serves Level 2 emergency lighting?
Expected: Panel EH-2.
Behavior: Direct retrieval from `Panelboards`.

8. Q: What does this document say about generator manufacturer?
Expected: The manufacturer is not identified/provided in this document.
Behavior: Refusal/unsupported-answer behavior, grounded to `Known Exclusions`.

9. Q: What conduit size feeds MSB-1?
Expected: Not defined in this document.
Behavior: Refusal/unsupported-answer behavior, grounded to `Known Exclusions`.

10. Q: Summarize what the generator serves and does not serve.
Expected:
- Serves life safety, legally required standby, and selected critical tenant backup loads.
- Does not serve normal HVAC loads.
Behavior: Grounded synthesis from `Generator and Emergency Power`.

11. Q: Give me all short-circuit current values in this document.
Expected: None are provided; document explicitly excludes short-circuit current values.
Behavior: Refusal/unsupported-answer behavior, grounded to `Known Exclusions`.

## Pass Criteria
- Q1-Q7: factually correct and grounded.
- Q8, Q9, Q11: explicit unsupported answer, no fabrication.
- Q10: accurate synthesis without adding unmentioned loads or specs.
