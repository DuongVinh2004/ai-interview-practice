# Review profile: AI evaluation and provider boundary

Activate for question generation, scoring/evaluation, prompt/rubric changes, provider adapters, model selection, safety filters, or learning recommendations derived from AI output.

Check at minimum:

- AI remains advisory/practice-only and cannot become an automated hiring decision;
- score/feedback is validated against rubric and answer evidence;
- prompt/rubric/provider/model versions are traceable where required;
- malformed/provider-untrusted output is validated before entering domain state;
- prompt injection and unsafe content paths are handled per security docs;
- data minimization/redaction rules are preserved;
- eval/golden/adversarial evidence is updated for behavior-affecting changes;
- provider-specific details do not leak into provider-independent domain contracts;
- cost/latency/failure/degraded behavior is considered;
- real provider calls remain gated until evaluation and privacy/security prerequisites are satisfied.

Unsupported scoring, protected-trait inference, lie detection/personality inference from face/voice, or bypass of the practice-only boundary is a stop condition.
