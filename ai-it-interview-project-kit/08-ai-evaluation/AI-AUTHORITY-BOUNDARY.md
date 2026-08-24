# AI authority boundary

## Product boundary

AI Interview Practice is a learning and self-practice product. It may generate questions, analyze submitted answers, explain a rubric, recommend study activities, and surface uncertainty. It must not rank applicants for employment, recommend hiring or dismissal, infer protected characteristics, or present its output as an objective measure of a person's employability.

## Allowed actions

- Generate draft questions from an approved taxonomy and blueprint.
- Evaluate an answer against a versioned rubric and cite answer excerpts as evidence.
- Ask a clarifying question when evidence is insufficient.
- Recommend learning resources and a practice plan.
- Flag unsafe, malformed, or suspicious input for review.

## Prohibited actions

- Emotion, facial-expression, deception, personality, disability, ethnicity, gender, age, or health inference.
- Scraping a candidate's external profile without explicit consent.
- Reusing private answers to train a model without a separate opt-in legal basis.
- Silent autonomous changes to rubrics, score weights, or published question packs.
- Using practice scores as an automated employment decision.

## Control model

Every AI output records `provider`, `model`, `promptVersion`, `rubricVersion`, input hashes, latency, token usage, safety result, confidence, and trace ID. Low-confidence or schema-invalid output falls back to retry, deterministic feedback, or an honest unavailable state. Content reviewers approve published rubrics and question packs. Administrators can configure providers but cannot disable platform safety invariants.

## User-facing disclosure

Before the first session, the candidate sees that feedback is AI-assisted, may be wrong, is for practice only, and can be reported. Results must distinguish observed evidence, rubric interpretation, confidence, and suggested next steps.
