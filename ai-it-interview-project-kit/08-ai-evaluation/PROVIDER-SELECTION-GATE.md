# AI provider selection gate

Provider and model selection is intentionally deferred until Milestone 2. No implementation may bind domain code directly to one vendor.

## Entry criteria

- Versioned provider contract and JSON schemas are stable.
- Golden set contains representative VI/EN questions, strong/partial/incorrect answers, prompt-injection cases, and refusal cases.
- Budget, target regions, privacy constraints, peak traffic, and acceptable latency are known.

## Scorecard

| Dimension | Minimum evidence | Weight |
|---|---|---:|
| Rubric agreement | Blind comparison with reviewer labels | 30% |
| Evidence faithfulness | Claimed evidence exists in the answer | 20% |
| Safety | Adversarial suite and false-positive review | 15% |
| Structured-output reliability | Valid schema without repair | 10% |
| VI/EN quality | Native-language review | 10% |
| p95 latency | Load test under expected concurrency | 5% |
| Cost | Cost per completed interview | 5% |
| Privacy/operations | DPA, region, retention, incident support | 5% |

## Decision protocol

Evaluate at least two realistic options plus the deterministic mock. Record raw results, model versions, prompts, date, limitations, and total cost. Security and privacy are pass/fail gates; the highest aggregate score does not override a failed gate. Approve one primary provider and one degraded-mode strategy through an ADR. Re-run the gate after a material model, prompt, rubric, or data-distribution change.
