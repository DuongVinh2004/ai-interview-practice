# Prompt and rubric versioning

Prompts and rubrics are production artifacts, not untracked strings.

## Required metadata

Each artifact has an immutable ID, semantic version, locale, status (`draft`, `review`, `published`, `retired`), owner, reviewer, change reason, timestamps, input/output schema versions, compatible model family, and content hash. Published versions are immutable; corrections create a new version.

## Lifecycle

1. Author edits a draft outside the request path.
2. Automated schema, snapshot, adversarial, and golden-set tests run.
3. A second reviewer approves material scoring changes.
4. Canary traffic compares the candidate against the current version.
5. Promotion pins the version in new sessions; existing sessions retain their original version.
6. Rollback changes only the active pointer and never rewrites historical evaluations.

## Compatibility rules

- A session pins blueprint, question-pack, prompt, rubric, taxonomy, and provider configuration versions.
- Evaluation results store normalized scores plus the original provider response in a restricted record.
- Schema changes follow expand/migrate/contract and support at least one previous consumer version.
- Re-evaluation creates a linked result; it never replaces the original.

## Review triggers

Review is mandatory for weight changes, pass-band changes, new inferred fields, changed safety behavior, new locales, model migrations, or statistically significant drift.
