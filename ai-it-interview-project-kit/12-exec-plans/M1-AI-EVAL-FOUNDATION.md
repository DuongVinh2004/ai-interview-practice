# M1 AI evaluation foundation ExecPlan

## Purpose

Replace anecdotal/length-based evaluation with provider-independent, evidence-based, measurable VI/EN feedback before connecting a production model.

## Preconditions

M0 auth, ownership, migrations, audit, and CI gates are green. Product boundary remains learning-only. Content and AI-quality owners are assigned.

## Outcomes

- Versioned question, prompt, rubric, and evaluation schemas.
- Application-computed rubric totals with criterion evidence and confidence.
- Synthetic/licensed VI/EN golden set and adversarial suite with reviewer guidance.
- Reproducible eval runner/report and candidate-versus-control comparison.
- Deterministic mock implements the same contract and failure modes.
- Honest degraded UI when evaluation is unavailable or uncertain.

## Milestones

- [ ] Approve rubric semantics, evidence format, score bands, and prohibited inferences.
- [ ] Implement shared schemas, persistence versions, contract fixtures and migration.
- [ ] Build deterministic evaluator, schema validation, bounded repair/fallback and audit metadata.
- [ ] Create representative golden/adversarial cases with dual review for high-impact labels.
- [ ] Implement metrics, slice reports, cost/latency capture and promotion gates.
- [ ] Validate UX disclosure, report/appeal flow, accessibility and retention controls.

## Verification

Unit-test deterministic score computation and schema boundaries; contract-test provider adapters; integration-test immutable/linkable evaluations; run golden and adversarial suites twice for reproducibility; manually review VI/EN evidence faithfulness; test injection, leakage, verbosity manipulation, timeouts, invalid JSON and provider outage.

## Decision gate

This milestone does not select a production provider. Completion produces the evidence harness required by `08-ai-evaluation/PROVIDER-SELECTION-GATE.md`.

## Stop conditions

Stop for unclear rubric ownership, insufficient reviewer competence, personal/production data in the eval set, discriminatory slice behavior, unsupported claims above approved threshold, or attempts to use scores for hiring decisions.
