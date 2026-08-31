# Entitlement reconciliation runbook

## Scope

This runbook applies to durable reservations for paid audio, vision, and answer-reveal operations. A reservation is created before a paid provider is contacted. `RECONCILIATION_REQUIRED` means the provider outcome is unknown; it is deliberately not automatically refunded.

## Automated safe handling

Every five minutes, `EntitlementReconciliationService` examines expired `RESERVED` records:

- No `providerDispatchStartedAt`: release the reservation with `expired_before_provider_dispatch`.
- Dispatch recorded: transition to `RECONCILIATION_REQUIRED`; leave its bucket balance reserved.

The worker must remain enabled in every API/worker deployment. Alert when reconciliation-required records are older than one hour or when the worker logs repeated failures.

## Manual resolution

1. Locate the reservation by its ID, provider, operation ID, idempotency key, and user. Preserve the provider response/request evidence with the incident record.
2. If the provider confirms it did not process the operation, invoke `resolveReconciliation` with `outcome: NO_PROVIDER_USAGE` and the evidence. This atomically releases only that reservation.
3. If the provider confirms usage, invoke `resolveReconciliation` with `outcome: CONFIRMED_PROVIDER_USAGE`, the exact positive whole-unit quantity, provider identifiers, and evidence. This atomically converts the reservation to consumed usage and writes the linked billing usage record for audio or vision.
4. If confirmed usage would exceed the remaining entitlement limit, do not alter balances manually. Escalate to billing/security for an approved account adjustment; the reservation remains fail-closed.

Never delete or directly edit entitlement buckets, reservations, or usage records to resolve an incident. The service transaction and its version check are the authoritative balance mutation boundary.

## Evidence and audit checks

For every resolved record, verify:

- state is `RELEASED` only with proof of no provider usage, or `COMMITTED` with the exact confirmed usage;
- `reconciledAt`, `resolutionReason`, and `reconciliationData` contain the outcome/evidence;
- the bucket's `reserved` and `consumed` values changed exactly once; and
- audio/vision usage has a `UsageRecord` linked by `reservationId`.
