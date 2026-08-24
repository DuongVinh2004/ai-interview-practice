# Authentication, sessions, and MFA

## Password authentication

Use a modern memory-hard password hash with tuned work factor, breached/common-password screening, generic login/reset responses, email verification, progressive throttling, and secure one-time reset tokens. Never log passwords, reset tokens, access tokens, MFA secrets, or recovery codes.

## Session model

- Short-lived access token; opaque, high-entropy refresh token stored only as a hash server-side.
- Refresh-token rotation with a session-family identifier. Reuse of a retired token revokes the family and emits a high-signal audit event.
- Session inventory lets users revoke individual or all sessions.
- Role, password, MFA, or suspicious-account changes revoke affected sessions.
- Browser storage follows the chosen threat model; if cookies are used, set `HttpOnly`, `Secure`, restrictive `SameSite`, bounded path/domain, and CSRF protection.

## Mandatory admin MFA

Organization Admin, Content Admin, Security Admin, Billing Admin, and Platform Admin must enroll MFA before privileged access. TOTP is the baseline; WebAuthn/passkeys are the preferred follow-up. Enrollment requires recent authentication. Recovery codes are single-use, hashed, displayed once, and regenerating them revokes prior codes.

High-risk actions require step-up authentication: changing roles, disabling MFA, exporting bulk data, changing AI/provider configuration, viewing recovery material, rotating signing keys, and modifying audit/retention settings. Administrators cannot exempt themselves. Recovery uses verified, audited support workflow with cooling-off controls; it never accepts MFA secrets over chat or email.

## Tests

Cover token replay, concurrent refresh, logout/revocation, privilege changes, MFA bypass, recovery-code reuse, enrollment race, rate-limit evasion, cross-user session access, and clock skew.
