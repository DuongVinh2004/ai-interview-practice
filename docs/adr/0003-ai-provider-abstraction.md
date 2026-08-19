# ADR 0003: AI Provider Abstraction and Mocking Strategy

## Status

Accepted

## Context

The application relies heavily on Large Language Models (LLMs) to generate questions, evaluate candidate answers against structured rubrics, and produce personalized learning paths. Direct coupling between business modules and specific external AI APIs (e.g. OpenAI, Anthropic, Gemini) creates vendor lock-in, increases test fragility, and imposes paid API dependencies on local development and CI pipelines.

## Decision

1. We define a domain-level `AiProvider` interface specifying typed contracts for question generation, evaluation, and learning path creation.
2. We implement `MockAiProvider` as a deterministic, zero-dependency, fast adapter used by default for local development, unit tests, and Playwright E2E tests.
3. We implement `ExternalAiProvider` as a configuration-driven adapter with safe validation that fails fast if enabled without credentials.
4. Business modules interact exclusively through `AiOrchestratorService`, which handles prompt registry retrieval, output schema validation via Zod, retries with backoff, and audit logging in the `AiRun` table.

## Consequences

- **Positive**: Zero cost and 100% deterministic local/CI test runs; seamless switching between mock and external providers via the `AI_PROVIDER` environment variable.
- **Negative**: Mock provider data must be kept representative of realistic LLM outputs.
