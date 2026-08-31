# Production Readiness Decision Register

This register follows section 31.1 of the Production Readiness Execution Plan.
`PROPOSED` is analysis for the accountable owner; it is not approval. Under
Execution Model Amendment 002, `sol high` performs coordinator self-review and
independent AI review is optional/non-blocking. Duong Vinh remains the decision
owner and the only accountable approver for staging, production, and L2-L6
actions.

## Status summary

| Decision | Status     | Blocks                                 |
| -------- | ---------- | -------------------------------------- |
| DEC-001  | `APPROVED` | G0 and all tasks                       |
| DEC-002  | `APPROVED` | PRD-1001, PRD-1004                     |
| DEC-003  | `APPROVED` | PRD-1002, PRD-1003                     |
| DEC-004  | `APPROVED` | PRD-1003, PRD-5003                     |
| DEC-005  | `APPROVED` | PRD-1101, PRD-5003                     |
| DEC-006  | `APPROVED` | PRD-1102, PRD-5001                     |
| DEC-007  | `APPROVED` | PRD-1201, PRD-5004                     |
| DEC-008  | `APPROVED` | PRD-1202, PRD-5004, PRD-5005           |
| DEC-009  | `APPROVED` | PRD-1401, PRD-1402, PRD-1403, PRD-5009 |
| DEC-010  | `APPROVED` | PRD-1402, PRD-5005, PRD-5006, G5       |
| DEC-011  | `OPEN`     | PRD-5008, G5, G6                       |
| DEC-012  | `OPEN`     | PRD-3001 through PRD-7001              |
| DEC-013  | `OPEN`     | PRD-6001 through PRD-7001              |

## DEC-001 — Ownership and approval authority

- **Status:** `APPROVED` by direct user decision and Amendment 001.
- **Decision:** The owner matrix, notification target state, response targets,
  escalation rules, and accountable-human production authority are those in
  `docs/operations/production-readiness-owner-matrix.md`.
- **Evidence:** Owner matrix SHA-256
  `d2ca4474f4c1f614470b63c8f58d7684cc7dc1f88733cde086b20b13a8ce7082`;
  closure record `PRD-0001`.
- **Approved at UTC:** Recorded in the append-only PRD-0001 closure history.
- **Supersedes:** The original open DEC-001 row in the plan.

## DEC-002 — Durable deletion model

- **Status:** `APPROVED` by direct user authorization.
- **Context:** `FileAsset` lacks deletion/version/retry/legal-hold state. Current
  deletion removes database metadata before provider deletion; S3 versioning is
  enabled while provider deletion is key-only. Retention callers can continue
  after provider deletion failure.
- **Options considered:** additive state machine plus durable outbox/reconciler;
  separate deletion ledger table; retain synchronous deletion.
- **Decision:** Use an additive durable state machine with
  `ACTIVE -> DELETION_PENDING -> DELETED_TOMBSTONE`, recoverable
  `DELETION_FAILED` attempts, and a separately enforced legal-hold state/flag.
  Persist the pending/outbox record transactionally before cloud mutation. Run a
  storage-deletion worker with 3 attempts, exponential backoff from 2 seconds,
  and retained failures. Capture object version identity. Never remove metadata
  before confirmed provider success.
- **Impact:** Fixes the DB-first orphan/retry-reference loss but requires an
  additive Prisma migration, provider interface changes, queue/worker,
  reconciler, metrics, and restart/concurrency/failure tests.
- **Conservative owner defaults selected under authorization:** Normal user or
  retention deletion creates an S3 delete marker for the captured object version;
  it never performs an all-version purge. `LEGAL_HOLD` wins over every deletion
  request and returns a non-terminal held result without invoking the provider.
  After 3 automated attempts at 2-second exponential backoff, the request becomes
  `DELETION_FAILED` but retains its durable retry handle indefinitely. Reconcile
  pending records every 5 minutes and treat age above 15 minutes as stale. Keep
  tombstone, outbox, version identity, and audit metadata for at least 90 days and
  do not automatically purge them until DEC-011 or a later explicit retention
  decision authorizes it.
- **Decision owner:** Duong Vinh as Data/DB Owner and Application Owner.
- **Coordinator review:** `sol high`; independent AI review optional.
- **Approved at UTC:** `2026-08-31T16:05:06.2896465Z`.
- **Authorization reference:** Direct user message: `APPROVE DEC-002 THROUGH
DEC-010 AS PROPOSED, INCLUDING PROPOSED NUMERIC TARGETS`, with authority for
  the `sol high` coordinator to resolve listed owner inputs conservatively within
  L1. No L2-L6 authority is implied.
- **Rationale:** Prefer recoverable retained state and fail-closed legal-hold
  behavior over irreversible purge or loss of retry evidence.
- **Invalidation conditions:** Any change to terminal states, provider versioning
  semantics, retry count/backoff, reconcile threshold, legal-hold precedence, or
  retention period invalidates PRD-1001/1004 evidence.
- **Evidence:** `apps/api/prisma/schema.prisma:1425`,
  `apps/api/src/modules/storage/storage.service.ts:297`,
  `infra/terraform/modules/storage/main.tf:29`, and the luna xhigh DEC-002 packet.

## DEC-003 — Shared upload-intent representation

- **Status:** `APPROVED` by direct user authorization.
- **Context:** Upload intent uses a process-local map and falls back to memory on
  Redis failure; production has multiple API replicas. Confirmation is not an
  atomic consume/CAS and the current TTL is one hour.
- **Options considered:** Redis plus Lua CAS; Redis `WATCH/MULTI`/`GETDEL`; a
  durable Prisma intent table.
- **Decision:** In production, use Redis key
  `upload_intent:<key>` with `SET ... NX EX 900`. Consume through one Lua CAS
  that verifies key, owner, and fingerprint and atomically returns/deletes the
  intent. Presign and confirm return retryable `503` when Redis is unavailable
  or not ready. Memory mode is local/test only and rejected by production
  configuration.
- **Impact:** Enables replica-safe single-use intents; requires Redis outage,
  replay, expiry, concurrent-confirm, wrong-owner, restart, and production
  fallback-rejection tests.
- **Conservative owner defaults selected under authorization:** Accept the
  900-second UX window. Design for at least 2 API replicas and require the same
  shared Redis store across every replica. Redis must use TLS, authentication,
  Multi-AZ automatic failover, and persistence appropriate to the existing
  production topology. Limit each user to 5 active intents and 10 presign
  requests per minute. Capacity uncertainty never enables memory fallback;
  readiness and capability issuance fail closed with retryable `503`.
- **Decision owner:** Duong Vinh as Application Owner and Security Owner.
- **Coordinator review:** `sol high`; independent AI review optional.
- **Approved at UTC:** `2026-08-31T16:05:06.2896465Z`.
- **Authorization reference:** Same direct DEC-002-through-DEC-010 user approval;
  L1 only.
- **Rationale:** A short-lived, bounded, atomic shared capability is the smallest
  design that remains correct under replica routing, restart, and Redis failure.
- **Invalidation conditions:** TTL, key/fingerprint representation, atomic Lua
  contract, active-intent/rate limits, replica topology, Redis durability, or
  fail-closed readiness changes invalidate PRD-1002/1003 evidence.
- **Evidence:** `apps/api/src/modules/storage/storage.service.ts:33`,
  `infra/terraform/modules/compute/main.tf:581`, and the luna xhigh DEC-003 packet.

## DEC-004 — Upload enforcement and category policy

- **Status:** `APPROVED` by direct user authorization.
- **Context:** Current direct presigned PUT has no provider-enforced byte range;
  runtime DTO parsing, intent binding, server-owned visibility, category limits,
  quotas, and lifecycle coverage are incomplete.
- **Options considered:** presigned POST with exact conditions; controlled upload
  proxy; retain post-upload-only signed PUT validation.
- **Decision:** Use presigned POST with exact key, category, MIME,
  metadata, and `content-length-range` conditions and a 900-second capability.
  Derive visibility from the server intent; only the explicit `public` category
  can be public. Before persistence, compare actual key, owner, category, MIME,
  and size. Add lifecycle/quarantine and quotas for every active prefix.
- **Approved category policy:** `documents` is private, maximum 5 MiB, and allows
  PDF, DOCX, and UTF-8 plain text. `system-design` is private, maximum 2 MiB, and
  allows PNG, JPEG, WebP, and JSON. `public` is maximum 2 MiB and allows only PNG,
  JPEG, and WebP; it remains quarantined/private until content and malware policy
  passes. `temp` is private, maximum 5 MiB, never independently publishable, and
  accepts only MIME types already allowlisted by its eventual destination.
- **Impact:** Addresses SEC-001 but requires storage contracts/controller/provider,
  web upload caller, lifecycle/IAM, negative byte/MIME/metadata/public/quota
  tests, and a public-content malware policy.
- **Conservative owner defaults selected under authorization:** Keep exactly the
  four existing prefixes `public/`, `documents/`, `system-design/`, and `temp/`.
  Filenames are 1-128 characters after normalization and reject controls, path
  separators, bidi controls, and ambiguous dot segments. Per user: 1 GiB stored,
  1,000 objects, 5 active intents, and 10 presigns/minute. Per tenant: 10 GiB and
  10,000 objects until a lower plan entitlement applies. Abandoned/quarantined
  objects expire after 24 hours. No throughput promise is made; quota or scanning
  uncertainty fails closed.
- **Decision owner:** Duong Vinh as Security, Product, and Data Owner.
- **Coordinator review:** `sol high`; independent AI review optional.
- **Approved at UTC:** `2026-08-31T16:05:06.2896465Z`.
- **Authorization reference:** Same direct DEC-002-through-DEC-010 user approval;
  L1 only.
- **Rationale:** Provider-enforced byte limits, narrow MIME allowlists, server-owned
  visibility, quarantine, and low quotas minimize security and cost exposure.
- **Invalidation conditions:** Category/prefix taxonomy, MIME allowlist, byte or
  quota limits, filename policy, visibility/scanning policy, capability TTL, or
  lifecycle retention changes invalidate PRD-1003/5003 evidence.
- **Evidence:** `packages/contracts/src/schemas/storage.ts:3`,
  `apps/api/src/modules/storage/providers/s3-storage.provider.ts:87`, and the
  luna xhigh DEC-004 packet.

## DEC-005 — ECS IAM/KMS action-prefix matrix

- **Status:** `APPROVED` by direct user authorization.
- **Context:** Web, API, and worker currently share one task role with bucket-wide
  S3 actions and broad KMS decrypt/data-key authority.
- **Options considered:** separate roles with one bucket and scoped conditions;
  separate category/component buckets and keys; remove only web access.
- **Decision:** Create distinct web/API/worker task roles. Web receives
  no S3/KMS data-plane permissions. API receives only the exact synchronous
  actions and approved prefixes. Worker receives no storage authority until
  retention/async ownership is explicitly worker-only, then only its proven
  action-prefix set. Keep execution roles separate, restrict deployment
  `iam:PassRole` to exact ARNs, and scope KMS using `kms:ViaService` plus S3
  encryption-context conditions.
- **Impact:** Reduces web-compromise blast radius; requires action inventory,
  role outputs, Terraform policy tests, IAM simulation/Access Analyzer, live
  allow/deny evidence, and resolution of retention-cron ownership.
- **Conservative owner defaults selected under authorization:** Use one encrypted
  application bucket with distinct roles and prefix conditions. Web has no S3 or
  KMS data-plane actions. API owns synchronous upload/download/delete and the
  existing retention cron; allow only the minimum object operations and
  prefix-scoped listing for `public/`, `documents/`, `system-design/`, and `temp/`
  plus `temp/quarantine/`. Worker has no S3/KMS permission until a later task
  proves an async storage call inventory. KMS is limited to the bucket through
  `kms:ViaService` and encryption-context conditions. Exact account, region, key,
  and role ARNs remain parameterized and blocked by DEC-012; L1 must not invent
  or apply them.
- **Decision owner:** Duong Vinh as Platform and Security Owner.
- **Coordinator review:** `sol high`; independent AI review optional.
- **Approved at UTC:** `2026-08-31T16:05:06.2896465Z`.
- **Authorization reference:** Same direct DEC-002-through-DEC-010 user approval;
  L1 only.
- **Rationale:** Default-deny worker/web access and scoped API ownership minimize
  blast radius while preserving the currently observed synchronous call path.
- **Invalidation conditions:** Runtime call ownership, bucket/prefix taxonomy,
  KMS key strategy, PassRole set, account/region/ARNs, or component topology
  changes invalidate PRD-1101/5003 evidence.
- **Evidence:** `infra/terraform/modules/compute/main.tf:202`,
  `infra/terraform/modules/storage/main.tf:5`, and the luna xhigh DEC-005 packet.

## DEC-006 — SSE authentication transport

- **Status:** `APPROVED` by direct user authorization.
- **Context:** The public SSE endpoint accepts a reusable access JWT in the query
  string, while the first-party web client already uses authenticated `fetch`
  with an Authorization header.
- **Options considered:** header-only bearer; authenticated single-use channel
  ticket; retain query JWT.
- **Decision:** Use header-only bearer authentication. Reject query
  credentials with `401`. Retain explicit session ownership/MFA authorization,
  CORS preflight support, and fresh-token reconnect behavior. A single-use
  ticket requires a later explicit exception for a proven headerless client.
- **Impact:** Removes reusable URL credentials; requires controller/integration,
  wrong-owner, reconnect, proxy-log-redaction, and browser tests.
- **Conservative owner defaults selected under authorization:** Only the existing
  first-party fetch-stream client is supported; native `EventSource` is not a
  supported requirement. Resolve a fresh access token for every reconnect rather
  than capturing one for the hook lifetime. Query credentials are rejected even
  when a valid header is also present. Proxy/application logs must omit query
  values and redact Authorization; any unverified logging configuration blocks
  live acceptance rather than restoring query-token support.
- **Decision owner:** Duong Vinh as Security and Application Owner.
- **Coordinator review:** `sol high`; independent AI review optional.
- **Approved at UTC:** `2026-08-31T16:05:06.2896465Z`.
- **Authorization reference:** Same direct DEC-002-through-DEC-010 user approval;
  L1 only.
- **Rationale:** Header-only fetch streaming already exists and removes reusable
  URL credentials without introducing a new ticket persistence contract.
- **Invalidation conditions:** Supported client set, reconnect/token lifecycle,
  authentication transport, ownership/MFA rules, or proxy logging behavior
  changes invalidate PRD-1102/5001 evidence.
- **Evidence:** `apps/api/src/modules/interview/interview.controller.ts:171`,
  `apps/web/src/hooks/use-interview-sse.ts:61`, and the luna xhigh DEC-006 packet.

## DEC-007 — AI timeout/retry/circuit/fallback semantics

- **Status:** `APPROVED` by direct user authorization.
- **Context:** Configuration exposes a 10-second timeout and two retries, but the
  router hard-codes retry count, SDK timeouts differ, Gemini lacks the same
  timeout control, and retries do not share a logical-request deadline/abort.
- **Options considered:** central router policy with propagated abort/deadline;
  provider-SDK-owned policy; disable post-dispatch retries.
- **Decision:** Make `AI_TIMEOUT_MS` the whole logical-request deadline
  and `AI_MAX_RETRIES` authoritative. Proposed defaults remain 10 seconds and 2
  retries. Retry only transport/network timeout, bounded 429, and transient 5xx.
  Never retry 400/401/403/404/409/422, validation, budget/quota, or open-circuit
  failures. Do not retry/fallback after an ambiguous post-dispatch outcome;
  preserve and reconcile the reservation. Count circuit failures per logical
  request and separate attempt/logical metrics.
- **Impact:** Aligns provider behavior and reduces duplicate spend/side effects;
  requires provider-interface abort support, taxonomy, budget reconciliation,
  circuit/fallback, 0/1/N retry, ambiguity, and redaction tests.
- **Conservative owner defaults selected under authorization:** Approve the
  10-second end-to-end deadline and 2-retry maximum. Retry network/transport
  failures, 408, bounded 429, and 500/502/503/504 only when no response outcome is
  ambiguous, using jittered backoff capped by the remaining deadline. Treat every
  other 4xx, validation, quota/budget, abort, and open-circuit error as
  non-retryable. Open a provider circuit after 5 logical-request failures in 30
  seconds, keep it open 30 seconds, and allow one half-open probe. Fallback is
  permitted only before dispatch or after an explicitly retry-safe failure.
  Reservation/settlement uses the logical request identity and remains pending
  for reconciliation after ambiguity. Provider generation itself is treated as
  potentially billable; authoritative application writes remain outside retry.
- **Decision owner:** Duong Vinh as Application and SRE Owner.
- **Coordinator review:** `sol high`; independent AI review optional.
- **Approved at UTC:** `2026-08-31T16:05:06.2896465Z`.
- **Authorization reference:** Same direct DEC-002-through-DEC-010 user approval;
  L1 only.
- **Rationale:** One propagated deadline and a narrow retry taxonomy bound latency,
  duplicate spend, and retry storms across providers.
- **Invalidation conditions:** Deadline/retry defaults, retryable taxonomy,
  backoff, circuit thresholds, fallback order, provider side effects, or
  reservation reconciliation changes invalidate PRD-1201/5004 evidence.
- **Evidence:** `apps/api/src/modules/platform/config/env.validation.ts:42`,
  `apps/api/src/modules/ai-orchestrator/router/provider-router.service.ts:365`,
  and the luna xhigh DEC-007 packet.

## DEC-008 — AI pricing and spend limits

- **Status:** `APPROVED` by direct user authorization.
- **Context:** Defaults are `$50` per UTC day and `$2` per provider call, but
  pricing maps are broad/hard-coded, model output is not universally bounded,
  settlement is not idempotent, and the production paid-call path can miss the
  cost metric used by the current alert.
- **Options considered:** versioned static model pricing plus enforced token
  caps; operator-managed external pricing; conservative fixed worst-case cost.
- **Decision:** Use a versioned static pricing map and reject unknown
  models. Use integer micro-USD. Proposed global targets: `$50.00` UTC-day hard
  cap, `$2.00` maximum paid-call reservation, rounding/settlement tolerance at
  most `$0.000001`, warning at `$40`/80%, critical at `$45`/90%, hard stop at
  `$50`/100%. Enforce provider input/output ceilings whose worst-case cost is at
  most `$2`, make settlement idempotent, and reconcile the budget ledger to
  provider-cost metrics.
- **Impact:** Requires model-map/version evidence, concurrency/rounding/repeated
  settlement/ambiguity tests, alert-fire evidence, and text/audio/vision ledger
  reconciliation.
- **Conservative owner defaults selected under authorization:** The initial paid
  allowlist is exactly `gemini-3.6-flash`, `gpt-4o`, and
  `claude-sonnet-4-20250514`; mock models have zero paid budget but cannot create
  authoritative effects. Each paid model must have a repository-controlled,
  versioned price row sourced from the provider's official price publication and
  reviewed before enablement; a missing/stale row disables that model. Text,
  audio, and vision share the same `$50.00` UTC-day hard cap and `$2.00` per-call
  reservation ceiling. The forecast is capped at `$40.00`/day; warning, critical,
  hard-stop, and micro-USD tolerance remain exactly the approved proposed values.
- **Decision owner:** Duong Vinh as Product/Finance delegate and SRE Owner.
- **Coordinator review:** `sol high`; independent AI review optional.
- **Approved at UTC:** `2026-08-31T16:05:06.2896465Z`.
- **Authorization reference:** Same direct DEC-002-through-DEC-010 user approval;
  L1 only.
- **Rationale:** A small explicit allowlist and shared hard cap fail closed on
  pricing drift and bound aggregate multimodal spend.
- **Invalidation conditions:** Model allowlist/version/prices, token ceilings,
  shared-cap scope, forecast, thresholds, rounding unit, or settlement/reconcile
  semantics changes invalidate PRD-1202/5004/5005 evidence.
- **Evidence:** `apps/api/src/modules/platform/configuration.ts:38`, provider
  pricing methods, budget service/router, and the luna xhigh DEC-008 packet.

## DEC-009 — Observability backend and notification topology

- **Status:** `APPROVED` by direct user authorization.
- **Context:** Prometheus rules and Grafana JSON exist, but no deployed collector,
  Alertmanager, dashboard provisioning, SNS notification IaC, or synthetic
  delivery evidence exists. API/worker expose private authenticated metric
  listeners, while the monitoring security group is not attached to compute.
- **Options considered:** CloudWatch-native; Amazon Managed Service for
  Prometheus plus Managed Grafana; approved external platform.
- **Decision:** Use AWS managed Prometheus/Grafana-compatible services
  with two collector replicas across two AZs, private-only authenticated scrape,
  a 15-second interval, and 30-day encrypted metrics retention. Route alerts to
  the approved staging/production SNS logical topics with GitHub Issue fallback.
  Keep secrets/PII out of labels and normalize dynamic routes.
- **Impact:** Requires service/account/region/IAM design, collector and dashboard
  IaC, HA/private-scrape tests, rule lint, and PRD-5009 synthetic
  fire/delivery/ack/escalation/resolution chronology.
- **Conservative owner defaults selected under authorization:** Use Amazon Managed
  Service for Prometheus and Amazon Managed Grafana with an ECS collector service
  running 2 replicas across 2 AZs. Collector IAM permits only required scrape,
  remote-write, discovery, and dashboard-read paths; metrics are classified as
  internal operational metadata and must not contain user, tenant, prompt,
  filename, token, or secret labels. The L1 design is parameterized because exact
  account/region remains DEC-012. Do not proceed to L5 if the reviewed incremental
  managed-service estimate exceeds `$100/month`, subscriptions are unconfirmed,
  or private authenticated scrape cannot be proven.
- **Decision owner:** Duong Vinh as Platform and SRE Owner.
- **Coordinator review:** `sol high`; independent AI review optional.
- **Approved at UTC:** `2026-08-31T16:05:06.2896465Z`.
- **Authorization reference:** Same direct DEC-002-through-DEC-010 user approval;
  L1 only; no AWS or notification mutation authorized.
- **Rationale:** Managed HA storage/dashboard services plus private collectors
  minimize self-hosted operational risk while retaining fail-closed cost and
  identity gates.
- **Invalidation conditions:** Backend/service selection, account/region,
  collector placement/count/IAM, scrape interval/auth, retention, data
  classification, budget, or notification topology changes invalidate
  PRD-1401/1402/1403/5009 evidence.
- **Evidence:** `infra/prometheus/alert_rules.yml`, metrics exporter/worker,
  Terraform network/compute modules, owner matrix, and the luna xhigh DEC-009
  packet.

## DEC-010 — Numeric SLO/SLI, load and headroom

- **Status:** `APPROVED` by direct user authorization.
- **Context:** An existing SLO document defines journey targets, but alert
  thresholds are inconsistent and no approved peak, workload mix, headroom,
  duration, cost ceiling, or abort policy exists.
- **Options considered:** retain the current conservative baseline plus explicit
  load policy; tighten targets; introduce more journey-specific SLOs.
- **Decision:** Use a rolling 30-day window. Approved targets: core
  API/sign-in availability 99.9% (43m12s budget), answer persistence 99.99%
  (4m19s), read p95 at most 300 ms, answer acknowledgment p95 at most 800 ms,
  evaluation completion 99% within 60 seconds, and SSE freshness 99% within 5
  seconds. Require 30% headroom. Proposed load mix: 60% reads, 20% answer-submit,
  10% evaluation enqueue, 5% auth, 5% other; ramp 15 minutes, peak 30 minutes,
  and soak 4 hours at 50% peak.
- **Stop thresholds:** Immediate on data loss, duplicate authoritative side
  effects, monitoring loss, or AI hard-cap breach; also on 5xx above 1% for 2
  minutes, read p95 above 300 ms for 5 minutes, queue p95 above 30 seconds for 5
  minutes, or DB/Redis saturation above 80% for 5 minutes.
- **Impact:** Requires an SLI/SLO matrix, alert alignment/rationale, worker
  scaling decision, reproducible load/soak evidence, resource/cost telemetry,
  and abort/recovery logs.
- **Conservative owner defaults selected under authorization:** Critical journeys
  are sign-in, interview creation, answer persistence/acknowledgment, evaluation
  completion, and SSE progress. Baseline expected peak is 100 concurrent interview
  sessions and 50 HTTP requests/second; 30% headroom therefore means validation at
  130 concurrent sessions and 65 requests/second. Use a production-like dataset
  of at least 100,000 users and 1,000,000 interview turns in a disposable target.
  Worker capacity must maintain oldest-job age below 30 seconds and scale on the
  stricter of queue age/depth or 60% sustained CPU, never below 2 replicas in the
  approved production design. The staging load campaign cost ceiling is `$25`
  with a hard abort at `$30` or the shared AI hard cap, whichever occurs first.
  Multi-window burn alerts use 5-minute/1-hour fast burn and 30-minute/6-hour slow
  burn; every original stop threshold remains unchanged.
- **Decision owner:** Duong Vinh as Product and SRE Owner.
- **Coordinator review:** `sol high`; independent AI review optional.
- **Approved at UTC:** `2026-08-31T16:05:06.2896465Z`.
- **Authorization reference:** Same direct DEC-002-through-DEC-010 user approval;
  L1 only; this records targets but does not authorize load/soak/chaos.
- **Rationale:** Explicit moderate baseline traffic, production-like data volume,
  30% headroom, and low monetary abort ceilings make local design deterministic
  without claiming actual capacity.
- **Invalidation conditions:** Journey definitions, traffic/data forecast, SLO or
  error-budget targets, workload mix, ramp/peak/soak durations, headroom, scaling
  policy, cost ceiling, or abort/burn thresholds change invalidate
  PRD-1402/5005/5006/G5 evidence.
- **Evidence:** `ai-it-interview-project-kit/13-operations/SLO-ALERTING.md`,
  `infra/prometheus/alert_rules.yml`, compute autoscaling, and the luna xhigh
  DEC-010 packet.

## DEC-011 — Recovery objectives and evidence retention

- **Status:** `OPEN`.
- **Required owner input:** RPO, RTO, backup/restore freshness, compliance and
  evidence-retention windows, recovery budget.
- **Decision owner:** Duong Vinh as Data Owner and Production Approver.
- **Approved at UTC:** `null`.

## DEC-012 — Exact GitHub/AWS/Terraform/ECS/S3/KMS targets

- **Status:** `OPEN`.
- **Required owner input:** verified identifiers and credentials source for each
  staging/production target. Secrets must not be recorded in this register.
- **Decision owner:** Duong Vinh as Platform Owner.
- **Approved at UTC:** `null`.

## DEC-013 — Production change window and rollback observation

- **Status:** `OPEN`.
- **Required owner input:** change window, observation duration, rollback
  thresholds, incident status, on-call availability and access, prior resource
  identities.
- **Decision owner:** Duong Vinh as Production Approver and SRE Owner.
- **Approved at UTC:** `null`.

## Approval and invalidation rule

Approval requires a direct owner message naming each decision and accepting or
amending its exact proposed values. A recommendation does not satisfy task DoR.
Any change to candidate bytes, model/pricing list, AWS target, workload forecast,
SLO/cost target, topology, or security/data policy invalidates dependent evidence
under section 29 of the plan. No decision in this register authorizes L2-L6.
