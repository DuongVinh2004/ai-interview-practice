# ADR 0005: Semantic Caching and Vector Storage Strategy

## Status

Accepted

## Context

AI evaluation and question generation represent the highest recurring compute and latency cost in the platform. A significant portion of candidate questions and answers share high semantic similarity across interview sessions. Traditional exact-match hashing fails when prompts or responses vary slightly in phrasing or formatting.

## Decision

1. We introduce a `SemanticCacheService` in `ai-orchestrator` module that computes text embeddings (or deterministic hashes/normalized vectors in dev/CI) and matches against existing queries using Cosine Similarity with a configurable threshold (default `0.95`).
2. Exact prompt hash lookups are performed first as an O(1) fast-path before performing vector similarity search.
3. Cache entries are persisted with TTL, hit counters, and metadata (prompt version, model, rubric ID).
4. When `FEATURE_SEMANTIC_CACHE` is disabled (default), AI requests pass straight through to the provider router without caching overhead.
5. Invalidation hooks allow clearing entries by prompt version or manual admin triggers.

## Consequences

- **Positive**: Reduces AI provider API token consumption by an estimated 40–60% and response latency for cached questions/answers to <50ms.
- **Negative**: Adds embedding computation overhead on cache misses and requires cache invalidation logic when prompts or rubrics are updated.
