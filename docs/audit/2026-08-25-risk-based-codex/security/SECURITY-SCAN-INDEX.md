# Standard Security Scan Index

- Scan ID: `c7baf331-6938-498d-9d82-05a647f57395`
- Mode: Standard, single pass
- Scope: `apps/api/src`
- Target revision: `57ce104a6236cbe274782e401e391205c4b5c8e7`
- Status: **completed/sealed**
- Result: 11 findings — 3 high, 5 medium, 3 low
- TAC advisory: `not_granted`; scan vẫn chạy theo skill contract, không dùng TAC như authorization gate.
- Deep Scan: không chạy.

## Canonical artifacts

- [report.md](<C:/Users/Duong Vinh/AppData/Local/Temp/codex-security-scans-5MTqAU/ai-interview-practice/57ce104a6236cbe274782e401e391205c4b5c8e7_20260825T121032Z_85jp8o5m/report.md>)
- [findings.json](<C:/Users/Duong Vinh/AppData/Local/Temp/codex-security-scans-5MTqAU/ai-interview-practice/57ce104a6236cbe274782e401e391205c4b5c8e7_20260825T121032Z_85jp8o5m/findings.json>)
- [coverage.json](<C:/Users/Duong Vinh/AppData/Local/Temp/codex-security-scans-5MTqAU/ai-interview-practice/57ce104a6236cbe274782e401e391205c4b5c8e7_20260825T121032Z_85jp8o5m/coverage.json>)
- [scan-manifest.json](<C:/Users/Duong Vinh/AppData/Local/Temp/codex-security-scans-5MTqAU/ai-interview-practice/57ce104a6236cbe274782e401e391205c4b5c8e7_20260825T121032Z_85jp8o5m/scan-manifest.json>)

Canonical files nằm trong security workbench temp directory, không được copy/biến đổi vào audit tree. Consolidated report là lớp mapping/priority cho broader engineering audit.

## Mapping

| Canonical ruleId                                | Severity | Consolidated ID | Priority |
| ----------------------------------------------- | -------- | --------------- | -------- |
| `payment-webhook.unsigned-payos-fallback`       | high     | SEC-001         | P1       |
| `websocket-auth.incomplete-jwt-revalidation`    | high     | SEC-002         | P1       |
| `admin-auth.mfa-enrollment-bypass`              | high     | SEC-003         | P1       |
| `idor.behavioral-answer-report`                 | medium   | SEC-004         | P2       |
| `storage.unregistered-object-ownership`         | medium   | SEC-005         | P2       |
| `mentor-authorization.unscoped-score-override`  | medium   | SEC-006         | P2       |
| `resource-amplification.unbounded-judge0-tests` | medium   | SEC-007         | P2       |
| `logging.secret-bearing-share-url`              | medium   | SEC-008         | P2       |
| `share-feedback.passcode-bypass`                | low      | SEC-009         | P3       |
| `redirect.payos-untrusted-return-url`           | low      | SEC-010         | P3       |
| `secrets.hardcoded-vapid-private-key`           | low      | SEC-011         | P3       |

Parent-only security/privacy findings ngoài scan scope: SEC-012 (frontend logout không revoke), PRIV-001 (authenticated caches cross-account), PRIV-002 (retention/export/delete lifecycle).

## Coverage/limitations

Risk-based review inventory có 306 files trong scope; high-risk surfaces được review sâu, low-risk DTOs/helpers/tests được sample hoặc explicit exclude. Không Git history, runtime exploitation, network, production observation, Deep Scan hay full test rerun. Production secrets/topology/log ACL/provider contracts vẫn unknown.
