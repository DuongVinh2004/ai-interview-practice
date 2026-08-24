# Golden set and AI evaluations

## Dataset design

The golden set is a versioned, access-controlled test asset with synthetic or licensed content. It covers VI/EN, backend/frontend/DevOps/data/QA/security, junior-to-senior levels, conceptual/coding/system-design/behavioral formats, short and long answers, partial correctness, uncertainty, and adversarial inputs.

Each case contains input, pinned rubric, reviewer labels, acceptable score interval, required evidence, forbidden claims, safety expectation, and rationale. At least two qualified reviewers label high-impact cases; disagreements are adjudicated and retained.

## Metrics

- Criterion score agreement and weighted quadratic kappa.
- Exact/semantic evidence precision and unsupported-claim rate.
- Rank correlation is diagnostic only; the product does not rank candidates.
- Structured-output success and repair rate.
- Refusal, prompt-injection resistance, toxicity, and privacy leakage rates.
- Slice metrics by locale, topic, seniority, answer length, and question type.
- p50/p95 latency, tokens, and cost per evaluation.

## Gates

No model/prompt/rubric promotion when a critical safety case regresses, unsupported-claim rate exceeds the approved threshold, any major slice materially degrades without review, or the evaluation is not reproducible. Threshold values are baselined in M1 and approved in an ADR; they may tighten but not silently loosen.

## Leakage control

Golden cases are never included in production prompts or training exports. Access is least privilege, all exports are audited, and evaluation identifiers rather than full content appear in ordinary CI logs.
