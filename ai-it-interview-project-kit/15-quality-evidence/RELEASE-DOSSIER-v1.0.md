# Production Release Dossier & Controlled Launch Plan (v1.0) — AIP-063 / AIP-064

## 1. Release Identification & Executive Summary

- **Release Version**: `v1.0.0-GA`
- **Release Target**: Production Staging -> Canary -> General Availability
- **Target Git SHA / Branch**: Official verified `master` branch
- **Architecture**: NestJS 11 Modular Monolith, PostgreSQL 16 (Multi-AZ), Redis 7 (BullMQ), React 18 SPA, Multi-provider AI Router with Circuit Breaker.
- **Overall Release Status**: **GO (All Milestones M0–M5 Fully Verified)**

---

## 2. Multi-Role Sign-Off Matrix (Go / No-Go Decision Gate)

| Discipline | Lead / Owner | Gate Criteria | Sign-Off Verdict |
|---|---|---|---|
| **Security & Privacy** | Security Lead | SAST/SCA/Secret scans green; Pen test findings resolved; DPIA & GDPR/PDPA notices complete. | **GO ✅** |
| **Platform & IaC** | Staff SRE | Modular Terraform validated; ECS Fargate & Multi-AZ RDS tested; zero drift detected. | **GO ✅** |
| **AI Quality & Safety** | AI Platform Lead | Golden eval benchmarks pass quality threshold; prompt injection filter active; circuit breaker verified. | **GO ✅** |
| **Data & DR** | Data Platform Lead | Encrypted PITR backups automated; quarterly restore drill RTO/RPO objectives met (RTO < 60m, RPO < 15m). | **GO ✅** |
| **Product & UX** | Product Lead | Bilingual VI/EN localization complete; WCAG accessibility verified; core candidate flows validated. | **GO ✅** |
| **Release Management** | Release Engineer | Automated CI/CD pipeline green; Canary rollout plan and rollback triggers established. | **GO ✅** |

---

## 3. Phased Canary Rollout Strategy

```mermaid
flowchart LR
    P0[Phase 0: Staging Verification<br/>Internal Smoke Tests] --> P1[Phase 1: 5% Canary Pilot<br/>Internal Beta Users (48h)]
    P1 --> P2[Phase 2: 25% Early Access<br/>Opt-in Candidates (72h)]
    P2 --> P3[Phase 3: 100% General Availability<br/>Full Public Traffic]
```

### Stage Milestones
1. **Phase 1 (5% Traffic / Internal Beta)**:
   - Route 5% of web/API traffic via ALB weighted target groups.
   - Monitor error rates, p95 latency, and BullMQ queue lag for 48 hours.
2. **Phase 2 (25% Traffic / Early Access)**:
   - Expand to 25% of candidate base.
   - Monitor AI token consumption and daily spend rate vs budget.
3. **Phase 3 (100% GA)**:
   - Switch 100% production traffic to `v1.0.0-GA`.
   - Scale ECS Fargate API replicas from 2 to 4 and BullMQ workers from 2 to 4.

---

## 4. Automated Rollback Triggers & Fast Rollback Runbook

### Automatic Rollback Conditions
If any of the following conditions occur for > 3 minutes during Canary:
- **HTTP 5xx Error Rate** > **1.0%**
- **Core Read p95 Latency** > **800ms**
- **Answer Submission Persistence Failure** > **0.0%**
- **Evaluation Pipeline Error Rate** > **2.0%**

### Fast Rollback Procedure (< 5 minutes)
1. **ALB Traffic Shift**: Re-point Application Load Balancer target group to previous stable task definition (`100%` rollback).
2. **Worker Draining**: BullMQ workers continue draining existing jobs; new incoming jobs halt gracefully.
3. **Database Safeguard**: Migrations are strictly backward-compatible (additive only); zero rollback migrations required on data tier.
4. **Notification**: PagerDuty incident automatically created with Grafana dashboard snapshot and logs.

---

## 5. Data Protection Impact Assessment (DPIA) & Consent Inventory

- **Personal Data Collected**: Email, hashed password, interview responses (text/audio), evaluation scores, and pseudonymized audit logs.
- **Lawful Basis**: User explicit consent (bilingual terms & privacy policy agreed upon registration) and legitimate interest for educational service delivery.
- **Retention Policy**:
  - Raw audio recordings: Automatically archived to S3 Glacier at 90 days, purged at 365 days.
  - User exported packages: Expired and permanently purged from S3 after 7 days.
  - Account deletion: Right to be Forgotten (`/api/v1/profile/me/delete`) cascades across all sessions, turns, answers, and evaluations within 24 hours.
- **AI Privacy Safeguard**: No candidate answer data is used to train foundation models (enforced via commercial zero-data-retention API agreements with OpenAI, Google Gemini, and Anthropic).
