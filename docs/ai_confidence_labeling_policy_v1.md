# AI Confidence + Labeling Policy (v1)

## Mandatory Response Labels
Every AI response MUST include:
- `confidence_score` (0.00-1.00, numeric)
- `citations` (non-empty list for non-trivial claims)
- `corpus_coverage_pct` (0-100, percentage of relevant indexed corpus accessed/considered)
- `last_updated_date` (ISO date of newest cited source)

Response payload contract (minimum):
- `answer_text`
- `confidence_score`
- `citations[]` with artifact id + title + revision + issue date
- `corpus_coverage_pct`
- `last_updated_date`
- `review_required` (boolean)
- `review_reasons[]`

## Confidence Scoring Policy
- `>= 0.85`: High confidence; auto-return allowed if no other review trigger is present.
- `0.70 - 0.84`: Medium confidence; auto-return allowed only for non-sensitive, non-authority interpretations.
- `< 0.70`: Low confidence; mandatory human review before actionable use.

## Citation Requirements
- Any compliance, contract, design, or code-related claim MUST include at least one citation.
- Citations must reference authoritative or allowed-derived sources only.
- Superseded sources must be excluded unless explicitly requested for historical comparison.

## Corpus Coverage Policy
- `corpus_coverage_pct` must be reported even when low.
- If coverage < 60%, response must include warning: `Coverage below reliability threshold`.
- If coverage < 40%, set `review_required=true` automatically.

## Freshness / Last Updated Policy
- `last_updated_date` is computed from newest cited source date.
- If newest source is older than project freshness SLA, mark response stale.
- Default outdated definition: source is `>180 days` old for active project-phase queries unless user explicitly requests historical view.

## Human Review Triggers (Mandatory)
Human review is required when any of the following is true:
- Confidence below threshold (`confidence_score < 0.70`).
- Any sensitive classification involved (`Confidential` or `Client-Confidential`).
- Outdated docs cited (newest cited source exceeds outdated threshold for active scope).
- Conflicting sources detected across citations.
- Any `Record of Authority` artifact is interpreted beyond direct citations.

## Interpretation Limits for Record of Authority
- AI may summarize cited authority records but may not infer uncited binding conclusions.
- If user asks for interpretation beyond explicit citations, response must route to human review.
- `review_reasons` must include `authority_interpretation_limit` when triggered.

## Presentation Requirements (UI/API)
- Display confidence as numeric value and band (`High/Medium/Low`).
- Display citation list with status tags (`Issued`, `Superseded`, `Archived`).
- Display corpus coverage percent and stale-warning badge when applicable.
- Display last updated date in local timezone and ISO form.

## Definition of Done
- Mandatory response labels are fully defined and required.
- Human review triggers are explicit, testable, and include all required scenarios.
- Outdated definition is stated with numeric threshold.
- Authority interpretation limits prevent AI from acting as record.

## Tests
- `rg -n "Corpus coverage|confidence_score|last_updated_date|Human review triggers|outdated" docs/ai_confidence_labeling_policy_v1.md`
- Unit: response without citations for non-trivial claim is rejected.
- Unit: `confidence_score < 0.70` sets `review_required=true`.
- Unit: `corpus_coverage_pct < 40` sets `review_required=true` with reason `low_coverage`.
- Unit: sensitive classification forces review regardless of confidence.
- Unit: outdated source (`>180 days`) triggers `outdated_source` review reason for active queries.
- Manual: simulate conflicting citations and verify `review_reasons` includes `source_conflict`.