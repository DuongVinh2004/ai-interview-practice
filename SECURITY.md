# Security Policy & Vulnerability Disclosure Program (VDP)

The AI Interview Practice team takes the security, privacy, and integrity of our platform and users seriously. This document outlines our security policies, vulnerability reporting procedure, response Service Level Agreements (SLAs), and safe harbor commitments.

---

## 1. Reporting a Vulnerability

If you discover a security vulnerability or potential privacy issue in this repository or live services, please **do not open a public issue or discussion**.

Instead, report it privately using one of the following methods:

1. **GitHub Private Vulnerability Reporting** (Preferred):
   - Navigate to the **Security** tab of the repository on GitHub.
   - Click **Report a vulnerability**.
   - Provide comprehensive reproduction steps and evidence.

2. **Security Operations Email**:
   - Send an encrypted email (or plain email if PGP is unavailable) to: `security@ai-interview.example.com` / repository stewards.
   - Subject line format: `[VULNERABILITY] <Brief summary of finding>`

### Report Checklist

Please include the following in your report:

- Clear description of the vulnerability and its potential impact.
- Affected URL, API route, or code component.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- Any prerequisites (e.g., specific user role, authenticated state, network conditions).
- Your proposed remediation or mitigation (optional but appreciated).

---

## 2. Response Service Level Agreements (SLAs)

We commit to the following response timeline for all acknowledged security reports:

| Milestone / Action               | SLA Target                      | Description                                                           |
| -------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| **Initial Acknowledgment**       | **< 24 Hours**                  | Confirmation of receipt with an assigned incident tracking ID.        |
| **Triage & Validation**          | **< 72 Hours**                  | Verification of vulnerability severity, reproducibility, and scope.   |
| **Remediation Plan**             | **< 5 Business Days**           | Architecture/code fix designed and scheduled for testing.             |
| **Critical / High Fix & Deploy** | **< 14 Calendar Days**          | Patch deployed to production environments with verification evidence. |
| **Medium / Low Fix & Deploy**    | **< 30 Calendar Days**          | Patch deployed in next regular release cycle.                         |
| **Public Advisory / CVE**        | **Coordinated (90-day window)** | Release of release notes or CVE advisory after patch verification.    |

---

## 3. Scope & Rules of Engagement

### In-Scope

- Backend API services (`apps/api`): Authentication bypass, MFA subversion, privilege escalation, cross-user session access, insecure direct object reference (IDOR), SSRF, cryptographic weaknesses, and SQL/Command injection.
- AI Evaluation Pipeline: Prompt injection subversion leading to score manipulation, evaluation bypass, or private context exfiltration.
- Frontend Client (`apps/web`): Stored XSS, CSRF, sensitive data leakage in client-side state, and unauthorized admin UI exposure.
- Infrastructure & IaC (`infra/terraform/`): Publicly exposed internal databases/Redis, overly broad IAM roles, unencrypted buckets.

### Out-of-Scope

- Denial of Service (DoS / DDoS) attacks exhausting infrastructure resources without architectural vulnerability.
- Social engineering, phishing, or physical attacks against maintainers.
- Vulnerabilities requiring root/physical access to an already compromised local development machine.
- Theoretical issues without demonstrable security impact or reproducible PoC.

---

## 4. Coordinated Disclosure & Safe Harbor

We fully support ethical security research conducted in good faith. If you comply with this policy:

- We will **not** initiate legal action against you for research activities conducted under these terms.
- We will work transparently with you to understand and resolve the issue.
- You may publicly disclose the finding **only after** a patch has been released or after a mutually agreed 90-day coordinated disclosure window.

---

## 5. Security Architecture & Controls Overview

The platform enforces defense-in-depth security principles:

- **Authentication**: JWT access tokens (15m expiry), rotating refresh token session families with reuse detection, mandatory TOTP 2FA + hashed single-use recovery codes for administrative functions.
- **Authorization**: Role-Based Access Control (`CANDIDATE`, `MENTOR`, `ADMIN`) with row-level ownership validation on every session, turn, and evaluation query.
- **AI Safety**: Dual-layer input/output sanitization with `AiSecurityFilterService` detecting prompt injection, protected trait queries, and delimiter jailbreaks before provider dispatch.
- **Data Protection**: AES-256 server-side encryption for audio records and user exports, automated database backups with Point-in-Time Recovery (PITR), and cryptographic pseudonymization in audit logging.
- **Automated CI Scanning**: Continuous SAST (Semgrep), secret detection (Gitleaks), and software composition analysis (Trivy) enforced on all pull requests.
