# AI safety and adversarial test plan

## Threat classes

- Prompt injection in candidate answers, imported content, code comments, and retrieved context.
- Attempts to extract system prompts, rubric answer keys, other users' data, secrets, or provider credentials.
- Toxic, harassing, self-harm, sexual, illegal, or discriminatory content.
- Malicious code, oversized payloads, parser bombs, Unicode obfuscation, and resource exhaustion.
- Score manipulation through verbosity, keyword stuffing, role-play instructions, or encoded text.
- Model output containing executable HTML/Markdown, unsafe links, or invalid structured data.

## Expected controls

Untrusted input is delimited and never granted instruction authority. Retrieval is scoped to published content. Tool access is allowlisted and unnecessary tools are disabled. Inputs and outputs pass size, schema, content, and authorization checks. UI rendering escapes output. Logs redact secrets and sensitive answer text.

## Test cadence

Run deterministic adversarial cases on every relevant change, the extended suite nightly, and manual red-team exercises before provider/model launch and major releases. Record prompt/model versions and keep failures as regression cases.

## Stop conditions

Block release for cross-user disclosure, successful system-prompt/secret extraction, uncontrolled tool/action execution, systematic discriminatory scoring, unsafe content rendered as executable markup, or bypass of the practice-only product boundary.
