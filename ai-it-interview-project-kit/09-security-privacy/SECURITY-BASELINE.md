# Security baseline

The security program uses risk-based controls mapped to OWASP ASVS 5.0 for web/application security and OWASP AISVS 1.0 for AI-specific properties. Passing a scanner is not equivalent to being secure.

## Mandatory controls

- TLS in transit; authenticated encryption for sensitive data at rest; keys outside source code and rotated through a managed secret store.
- Deny-by-default authorization at the service boundary; object ownership checked on every user-scoped resource.
- Parameterized database access, strict schemas, safe output encoding, content-type validation, request-size limits, and rate limits.
- CSRF protection wherever cookie authentication is used; restrictive CORS and security headers.
- Dependency, secret, SAST, IaC, container, and license scans in CI with documented triage SLAs.
- Immutable audit events for authentication, authorization denial, admin action, content publication, data export/deletion, and AI configuration change.
- Production access through named accounts, MFA, time-bounded elevation, and recorded emergency access.

## Severity and remediation

Critical exploitable findings block release and trigger immediate incident assessment. High findings block release unless a time-bounded exception is approved by security and product owners. Medium and low findings enter a risk-ranked backlog. Exceptions include owner, rationale, compensating controls, expiry, and re-review date.

## Verification evidence

Each release links test results, scan artifacts, dependency inventory/SBOM, migration review, threat-model delta, unresolved risks, and approvers. Secrets and private answer content never appear in evidence artifacts.
