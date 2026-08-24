# Review profile: auth/security/ownership/MFA

Activate for authentication, authorization, user/session/admin, token, MFA, ownership, sensitive profile/history/result access, or security-control changes.

Check at minimum:

- authentication failure is fail-closed;
- authorization is enforced server-side and deny-by-default;
- cross-user resource access/IDOR negative cases exist;
- role/status/auth-version/session state cannot be client-controlled;
- access/refresh token type, expiry, rotation, replay and revocation semantics are correct;
- concurrent refresh/replay behavior is safe when applicable;
- account lock/logout/session invalidation semantics are preserved;
- admin-sensitive operations require approved MFA/step-up behavior;
- recovery codes/OTP cannot be replayed and are not logged;
- password/token/secret/OTP/PII redaction rules are preserved;
- mass assignment, privilege escalation and enumeration behavior are reviewed;
- rate limiting/abuse controls are considered where required by the spec;
- negative tests prove bypass attempts fail.

Any validated cross-user leakage, admin/MFA bypass, secret exposure, or fail-open authorization is a stop condition.
