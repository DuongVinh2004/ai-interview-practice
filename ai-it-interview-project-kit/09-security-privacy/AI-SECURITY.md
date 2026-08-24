# AI security controls

## Inputs and context

Treat all user answers, retrieved text, code, filenames, metadata, and provider responses as untrusted. Minimize PII before provider calls. Retrieval allowlists published resources and enforces locale/version/state. Prompts separate system policy, trusted rubric, and untrusted answer with explicit delimiters.

## Outputs

Require a strict versioned schema and reject additional fields. Validate numeric ranges, referenced criterion IDs, evidence offsets, URL schemes, and total size. Application code computes weighted scores. Escape content in every renderer; AI output never becomes SQL, shell, template source, policy, or tool instruction.

## Provider boundary

Credentials remain server-side in a secret manager. Egress is limited to approved endpoints. Timeouts, token budgets, retries, request IDs, and redacted audit metadata are mandatory. Provider retention/training settings and subprocessor terms are reviewed before activation.

## Model and artifact supply chain

Pin model aliases to observed version metadata where available. Prompts, rubrics, datasets, adapters, and moderation rules are versioned, reviewed, scanned, and rollback-capable. Golden sets are protected from training/test leakage.

## Monitoring

Alert on schema failures, prompt-injection detections, anomalous tokens/cost, safety overrides, evidence failures, unusual output similarity, provider endpoint changes, and cross-user identifiers. Logs contain hashes/IDs rather than full private answers by default.
