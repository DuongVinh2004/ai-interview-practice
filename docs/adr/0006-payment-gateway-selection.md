# ADR 0006: Payment Gateway and Billing Architecture Selection

## Status

Accepted

## Context

Monetization of the platform requires tiered subscription billing, usage metering (AI token / audio minute consumption), and checkout experiences supporting both international (USD) and local Vietnamese (VND) payment methods.

## Decision

1. We implement a provider abstraction layer `BillingProvider` supporting multiple payment adapters: `StripeProvider` for global card/subscription processing and `MockBillingProvider` for zero-dependency dev/CI testing.
2. Webhooks from payment gateways are received via dedicated endpoints, strictly validated with cryptographic signatures, and processed with database-level Idempotency records (`IdempotencyRecord`) to prevent duplicate subscription activations or billing events.
3. Feature gating is enforced via `QuotaGuard` which checks user subscription limits (sessions, audio minutes). When `FEATURE_BILLING` is `false` (default), access is unrestricted.
4. Currency and price computations strictly use exact arithmetic (`decimal.js` / Prisma `Decimal`) to prevent floating-point inaccuracies.

## Consequences

- **Positive**: Compliant, secure, PCI-DSS friendly architecture (no card data stored on-premise), seamless testing via mock provider.
- **Negative**: Requires maintaining webhook synchronization logic and background retry policies for webhook handling.
