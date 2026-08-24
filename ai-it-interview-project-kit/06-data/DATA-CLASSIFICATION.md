# Data classification

| Class | Ví dụ | Controls |
|---|---|---|
| Public | Landing, public taxonomy | Integrity, cache |
| Internal | Feature flags, non-secret config | RBAC, audit |
| Confidential | Email, profile, answer, transcript, score | Encryption, ownership, retention |
| Restricted | Password hash, refresh hash, MFA secret, provider key | Secret/KMS, strict IAM, never log |
| Derived sensitive | Competency profile, behavioral feedback | Purpose limitation, explainability, access control |

Voice recording là confidential/restricted tùy content. Không thu webcam/biometric trong scope hiện tại.

Data inventory phải ghi owner, purpose, legal basis, processor, storage region, retention, deletion path và backup behavior.
