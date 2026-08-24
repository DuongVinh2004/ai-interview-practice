# Authentication and ownership test matrix

## Authentication

- Correct/incorrect/unverified/disabled account login with non-enumerating responses.
- Password hash upgrade and reset-token expiry, replay, concurrent use, and invalidation.
- Refresh rotation, old-token replay, concurrent refresh, family revocation, logout-all, and password/role/MFA changes.
- Rate limits across account, IP, and device signals without trusting spoofed forwarding headers.
- Cookie/CSRF/CORS/header behavior for browser clients.

## MFA and admin

- Every privileged route rejects an admin without completed MFA enrollment.
- Enrollment requires recent authentication and verifies the first TOTP before activation.
- Recovery code is single-use; regeneration invalidates old codes; disabling MFA requires step-up.
- Clock-skew window is bounded; brute-force and enrollment races are limited.
- A non-admin cannot obtain admin scope by token claim mutation, role cache staleness, or organization switching.

## Ownership negative matrix

For each user resource—profile, session, answer, evaluation, learning plan, export, deletion request—test owner success and other-user read/update/delete denial using known valid IDs. Repeat through list filters, nested endpoints, SSE subscriptions, worker callbacks, report downloads, and predictable identifiers.

## Evidence

Tests assert status/error code and absence of leaked existence, metadata, or timing-sensitive content. Audit tests verify actor, target, action, outcome, correlation ID, and redaction.
