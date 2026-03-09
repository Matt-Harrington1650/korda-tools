# Current UI Audit

## Definition of Done
- Runnable host confirmed as `C:\code\ai-tool-hub` with active SOPHON route tree.
- Screen-level audit completed for shell, dashboard, SOPHON subpages, settings/form surfaces, and feedback states.
- Top 20 cross-product issues, top 10 SOPHON issues, and major consistency/readability/cognitive-load issues ranked.

## User Goal
- Find SOPHON quickly, understand current state, and complete source->index->query flow without confusion.

## Design / System Goal
- Reduce visual noise and interaction ambiguity; establish one coherent dark desktop visual system.

## Tests (steps + commands + expected result + actual result)
1. `rg -n -S "SOPHON|sophon|createBrowserRouter|path:" src src-tauri .`
- Expected: identify real SOPHON host and route entry.
- Actual: SOPHON route mounted in router and shell navigation.

2. `tree /F src`
- Expected: identify all user-facing screens and SOPHON modules.
- Actual: SOPHON pages under `src/pages/sophon/*`, app shell under `src/app/AppShell.tsx`.

3. `rg -n "bg-white|text-slate-900|border-slate-200" src`
- Expected: quantify style fragmentation.
- Actual: high count of legacy light utilities, proving inconsistent theme system before overhaul.

## Findings (severity-ranked P0/P1/P2/P3)
- P1: mixed light/dark systems increased trust and orientation friction.
- P1: SOPHON information hierarchy was flat; runtime status and action priority were visually competing.
- P1: multiple forms used inconsistent button/input semantics across SOPHON pages.
- P2: low consistency in status badges and empty-state wording.
- P2: routing discoverability depended on sidebar scanning instead of dashboard guidance.
- P2: screen density on source/settings pages was high for first-time users.
- P3: casing/naming inconsistency (`Sophon`/`SOPHON`) caused minor test and UX drift.

### Top 20 UI/UX issues across product
1. Mixed color systems in shell and SOPHON.
2. Inconsistent action button hierarchy.
3. Weak runtime readiness emphasis.
4. Dense forms with low scan segmentation.
5. No centralized theme tokens.
6. Legacy light utility overuse.
7. Inconsistent status badge semantics.
8. Inconsistent empty-state affordances.
9. Sparse first-step SOPHON onboarding on dashboard.
10. Variable border radius and spacing rhythm.
11. Inconsistent destructive action treatment.
12. Weak focus-ring consistency.
13. High visual contrast noise (white-on-dark mixing).
14. Inconsistent nav active-state style.
15. Settings sections visually blended together.
16. SOPHON control panels varied per page.
17. Readability drift in metadata text sizing.
18. Retrieval answer/citation presentation was under-differentiated.
19. Feedback tone differed by page.
20. No single documented visual grammar.

### Top 10 SOPHON-specific issues
1. Header/status cards lacked cohesive emphasis.
2. Tabs looked separate from page shell.
3. Source form was crowded with equal visual weight controls.
4. Ingestion actions lacked consistent intent coloring.
5. Index controls mixed primary/secondary affordances.
6. Retrieval output did not strongly separate answer vs passages.
7. Policy/audit severity labels were inconsistent.
8. Backup/restore controls did not match broader SOPHON button semantics.
9. Settings panels were visually fragmented.
10. Empty states varied by page and clarity level.

### Top 10 visual inconsistency issues
1. `bg-white` + `bg-slate-*` coexistence.
2. Mixed border opacities/colors.
3. Inconsistent card radii.
4. Mixed button palettes.
5. Mixed heading styles.
6. Mixed muted text shades.
7. Inconsistent badge backgrounds.
8. Inconsistent section spacing.
9. Mixed input backgrounds.
10. Inconsistent hover intensity.

### Top 10 interaction inconsistency issues
1. Button order varies for comparable flows.
2. Secondary actions sometimes styled as primary.
3. Checkbox rows inconsistent.
4. Different empty-state CTA patterns.
5. Inconsistent disabled affordance.
6. Different status messaging styles.
7. Inconsistent destructive control placement.
8. Varied panel composition rules.
9. Different loading text treatments.
10. Inconsistent form label casing.

### Top 10 readability issues
1. Light text on light backgrounds in mixed states.
2. Muted text contrast drift.
3. Dense metadata blocks without hierarchy.
4. Variable heading sizes.
5. Inconsistent uppercase label use.
6. Retrieval passages too visually similar to answers.
7. Audit entries dense at small size.
8. Snapshot rows under-emphasized metadata.
9. Settings helper text blending.
10. Large forms without section separators.

### Top 10 cognitive load issues
1. Too many equivalent controls visible at once.
2. State interpretation spread across multiple pages.
3. Limited guided next-step cues.
4. Source + options + actions densely packed.
5. Readiness details overwhelming for first-time users.
6. Sparse progressive disclosure.
7. Repeated status concepts in multiple visual styles.
8. Multiple panel patterns increase parsing cost.
9. Mixed terminology tone.
10. Low visual grouping discipline pre-overhaul.

## Evidence (file paths + line ranges + screenshots + DOM evidence + runtime output)
- Shell/nav baseline and final structure: `src/app/AppShell.tsx:64-170`.
- SOPHON route ownership: `src/app/router.tsx:39-52`.
- SOPHON shell/tabs/status cards: `src/pages/sophon/SophonLayout.tsx:4-63`.
- SOPHON page family exists and active: `src/pages/sophon/*.tsx`.
- Theme tokenization and component primitives: `src/index.css:5-420`.
- Runtime DOM evidence from test run confirms shell + dashboard render path:
  - `src/pages/sophon/SophonRouting.smoke.test.tsx:11-22`.
  - `npm run test` output (all tests passing after redesign).
- Detailed line-number dumps are stored in `internal/ui/artifacts/line_refs/*.txt`.

## Changes Applied
- None in audit phase (diagnostic baseline and evidence capture only).

## Re-test Results
- N/A for audit-only phase.

## Remaining Risks
- Full manual pixel review with desktop screenshots remains UNVERIFIED in this CLI-only run.
