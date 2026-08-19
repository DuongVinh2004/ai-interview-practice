# ADR 0002: Server-Sent Events with REST Polling Fallback

## Status

Accepted

## Context

Candidates experience asynchronous AI generation latency (1-5 seconds) when a question is prepared or an answer is evaluated. The client must reflect intermediate states (`CREATED`, `ACTIVE`, `EVALUATING`, `COMPLETED`, `FAILED`) without requiring the candidate to manually refresh the page.

WebSockets introduce bidirectional protocol overhead, stateful connection load balancers, and complex reconnection handshakes that are unnecessary for what is primarily a server-to-client event stream.

## Decision

1. We implement **Server-Sent Events (SSE)** via `@Sse('interviews/:id/events')` as the primary real-time transport mechanism.
2. Events emitted include `SESSION_UPDATED`, `QUESTION_READY`, `EVALUATION_COMPLETED`, `LEARNING_PATH_READY`, `SESSION_FAILED`, and a periodic 15-second `HEARTBEAT`.
3. If an SSE connection drops or is blocked by network proxies/firewalls, the frontend automatically falls back to interval polling `/interviews/:id/status` every 3 seconds.

## Consequences

- **Positive**: Lightweight HTTP-based unidirectional streaming, built-in browser reconnection, standard HTTP proxy support with disabled buffering, seamless REST fallback.
- **Negative**: Long-lived HTTP connections consume connection slots if reverse proxies are misconfigured.
