# Answer evaluation specification

## Evaluation shape

The evaluator returns:

- Per-criterion score, allowed range, confidence, and short rationale.
- Exact answer excerpts or structured observations supporting each score.
- Missing or contradictory evidence.
- Overall score derived deterministically from rubric weights.
- Actionable strengths, improvements, and recommended practice tasks.
- Safety flags and an explicit `needsReview` decision.

## Guardrails

The model does not receive a candidate's name, age, gender, university, employer, photo, or unrelated history. It must treat the answer as untrusted data and ignore instructions embedded inside it. It cannot change the rubric or compute the final weighted score; application code validates ranges and calculates totals.

## Confidence and fallback

High confidence requires criterion-level evidence and valid structured output. Missing evidence reduces confidence even if the prose sounds plausible. Schema failure receives one bounded repair attempt. Continued failure, provider timeout, contradictory evidence, or safety failure produces a degraded result with no fabricated score and a retry/review option.

## Appeals and reproducibility

Users can report feedback and request re-evaluation. The system retains the original result, creates a linked evaluation, and displays why results may differ. Audit records enable replay with the pinned artifact versions subject to provider availability and retention policy.
