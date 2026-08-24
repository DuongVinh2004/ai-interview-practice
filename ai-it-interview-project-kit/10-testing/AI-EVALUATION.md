# AI evaluation execution

## Suites

- `smoke`: small deterministic set on each AI-related PR.
- `regression`: complete golden set before release and nightly when provider access permits.
- `adversarial`: injection, leakage, manipulation, unsafe-content, and boundary cases.
- `calibration`: reviewer comparison and slice analysis before model/rubric promotion.
- `production-monitoring`: privacy-safe sampled outcome metrics and user reports, never silently reused as training data.

## Reproducibility record

Every run stores dataset/version hash, prompt/rubric/schema versions, provider/model metadata, parameters, evaluator code commit, start/end time, raw restricted outputs, normalized metrics, cost, and environment. A human-reviewed evaluation cannot use the same model as the only judge.

## Change protocol

Compare candidate versus control on identical cases. Investigate overall and slice deltas, not only averages. Required evidence/forbidden claims determine faithfulness. Promotion requires product, content, AI-quality, security, and privacy sign-off for material changes.

## Production feedback

Collect report reason and optional user note without exposing answer content to unauthorized staff. Link confirmed failures to a sanitized regression case. User-reported disagreement alone does not alter historical scores or retrain a model.
