# 04 — Evidence, Tests and Limitations

## Integrity baseline ngay trước khi viết

- Canonical root: `C:\Users\Duong Vinh\ai-interview-practice`
- Branch: `feat/uiux-transformation-roadmap`
- HEAD: `57ce104a6236cbe274782e401e391205c4b5c8e7`
- Staged: 0; modified: 105; untracked: 2; total porcelain items: 107.
- Output directory chưa tồn tại. Task chỉ tạo 10 files dưới `docs/audit/2026-08-25-risk-based-codex/`.

### Baseline path list (107)

```text
M README.md
M apps/api/prisma/seed.js
M apps/api/prisma/seed.ts
M apps/api/src/modules/admin/__tests__/eval-harness-precision.spec.ts
M apps/api/src/modules/ai-orchestrator/ai-orchestrator.service.ts
M apps/api/src/modules/ai-orchestrator/router/provider-router.service.spec.ts
M apps/api/src/modules/ai-orchestrator/router/provider-router.service.ts
M apps/api/src/modules/audio-orchestrator/audio-orchestrator.service.spec.ts
M apps/api/src/modules/audio-orchestrator/audio.controller.spec.ts
M apps/api/src/modules/auth/__tests__/mfa-challenge-replay.spec.ts
M apps/api/src/modules/auth/__tests__/mfa-step-up.guard.spec.ts
M apps/api/src/modules/auth/guards/mfa-step-up.guard.ts
M apps/api/src/modules/auth/strategies/jwt.strategy.ts
M apps/api/src/modules/b2b/__tests__/tenant-context-fail-closed.spec.ts
M apps/api/src/modules/billing/__tests__/payos-provider.spec.ts
M apps/api/src/modules/billing/__tests__/payos-webhook.spec.ts
M apps/api/src/modules/billing/billing.module.ts
M apps/api/src/modules/billing/billing.service.spec.ts
M apps/api/src/modules/billing/billing.service.ts
M apps/api/src/modules/billing/guards/__tests__/quota-guard.spec.ts
M apps/api/src/modules/billing/providers/payos.provider.ts
M apps/api/src/modules/email/email.module.ts
M apps/api/src/modules/email/email.processor.spec.ts
M apps/api/src/modules/email/email.processor.ts
M apps/api/src/modules/email/email.service.spec.ts
M apps/api/src/modules/email/providers/mock-email.provider.ts
M apps/api/src/modules/email/providers/resend-email.provider.ts
M apps/api/src/modules/email/templates.spec.ts
M apps/api/src/modules/email/templates/InterviewCompletionEmail.tsx
M apps/api/src/modules/email/templates/PaymentReceiptEmail.tsx
M apps/api/src/modules/email/templates/StreakWarningEmail.tsx
M apps/api/src/modules/email/templates/WelcomeEmail.tsx
M apps/api/src/modules/evaluation/evaluation.processor.ts
M apps/api/src/modules/gamification/badge.service.ts
M apps/api/src/modules/gamification/gamification.controller.ts
M apps/api/src/modules/gamification/gamification.listener.ts
M apps/api/src/modules/interview/interview.service.ts
M apps/api/src/modules/interview/processors/question.processor.ts
M apps/api/src/modules/notifications/notification.controller.ts
M apps/api/src/modules/notifications/push-notification.service.ts
M apps/api/src/modules/notifications/streak-reminder.cron.ts
M apps/api/src/modules/platform/config/configuration.ts
M apps/api/src/modules/storage/providers/mock-storage.provider.ts
M apps/api/src/modules/storage/storage.controller.spec.ts
M apps/api/src/modules/storage/storage.controller.ts
M apps/api/src/modules/storage/storage.module.ts
M apps/api/src/modules/storage/storage.service.spec.ts
M apps/api/src/modules/storage/storage.service.ts
M apps/api/src/modules/system-design/providers/gemini-vision.provider.ts
M apps/api/src/modules/system-design/providers/mock-vision.provider.ts
M apps/api/src/modules/system-design/providers/openai-vision.provider.ts
M apps/api/src/modules/system-design/services/design-evaluation.service.ts
M apps/api/src/modules/system-design/system-design.module.ts
M apps/api/src/modules/voice-gateway/providers/deepgram-stt.provider.spec.ts
M apps/api/src/modules/voice-gateway/providers/deepgram-stt.provider.ts
M apps/api/src/modules/voice-gateway/providers/elevenlabs-tts.provider.spec.ts
M apps/api/src/modules/voice-gateway/services/sentence-chunker.service.spec.ts
M apps/web/src/__tests__/DashboardProgressExperience.test.tsx
M apps/web/src/__tests__/DesignSystemComponents.test.tsx
M apps/web/src/__tests__/InterviewRoomExperience.test.tsx
M apps/web/src/__tests__/ResilienceAndA11y.test.tsx
M apps/web/src/__tests__/ResultDetailExperience.test.tsx
M apps/web/src/__tests__/SetupInterviewExperience.test.tsx
M apps/web/src/components/analytics/CompetencyRadarChart.tsx
M apps/web/src/components/billing/VietQrCheckoutModal.tsx
M apps/web/src/components/common/ErrorBoundary.tsx
M apps/web/src/components/common/FloatingXpDelta.tsx
M apps/web/src/components/layout/AppLayout.tsx
M apps/web/src/components/layout/Navbar.tsx
M apps/web/src/components/mobile/SwipeCard.tsx
M apps/web/src/components/ui/Breadcrumbs.tsx
M apps/web/src/components/ui/ConfirmationDialog.tsx
M apps/web/src/components/ui/ErrorState.tsx
M apps/web/src/components/ui/ProgressBar.tsx
M apps/web/src/components/ui/Select.tsx
M apps/web/src/components/ui/Skeleton.tsx
M apps/web/src/components/whiteboard/VisualAnnotationOverlay.tsx
M apps/web/src/features/auth/LoginPage.tsx
M apps/web/src/features/dashboard/DashboardPage.tsx
M apps/web/src/features/flashcards/FlashcardReviewPage.tsx
M apps/web/src/features/gamification/BadgesShowcasePage.tsx
M apps/web/src/features/gamification/LeaderboardPage.tsx
M apps/web/src/features/history/HistoryPage.tsx
M apps/web/src/features/history/ResultDetailPage.tsx
M apps/web/src/features/interview/InterviewRoomPage.tsx
M apps/web/src/features/readiness/ReadinessPage.tsx
M apps/web/src/features/setup/SetupInterviewPage.tsx
M apps/web/src/features/share/PublicSharedResultPage.tsx
M apps/web/src/features/system-design/WhiteboardRoom.tsx
M apps/web/src/features/system-design/useSystemDesign.ts
M apps/web/src/hooks/useCloudUpload.ts
M apps/web/src/lib/sfx-engine.ts
M apps/web/src/stores/gamification.store.ts
M apps/web/src/stores/i18n.store.ts
M docs/plans/UIUX-PLAN-B-C-CROSS-REFERENCE.md
M docs/ui-ux/baseline-audit.md
M docs/ui-ux/release-gate-report.md
M package.json
M packages/contracts/src/enums/index.ts
M packages/contracts/src/index.ts
M packages/contracts/src/schemas/auth.ts
M packages/contracts/src/schemas/billing.ts
M packages/contracts/src/schemas/gamification.ts
M packages/contracts/src/schemas/system-design.ts
M pnpm-lock.yaml
?? apps/api/src/modules/gamification/__tests__/gamification.controller.spec.ts
?? apps/api/src/modules/notifications/notification.controller.spec.ts
```

## Existing evidence packet

Supporting packet (không authoritative) ghi: 121 deduplicated test files; API unit/module 75; API AI eval/chaos 5; API integration/E2E 1; web 37; contracts 1; Playwright 2. 118 suites/424 tests pass; monorepo type-check và Prettier pass; lint 0 errors/665 warnings. API integration và Playwright skip; build chưa xác minh.

Known corrections được parent verify bằng current source: Stripe production missing-key fail closed (`billing.service.ts:37`); production text-AI loại mock/empty chain fail closed (`provider-router.service.ts:81-123`); evaluation và personalized learning path không dùng semantic cache (`provider-router.service.ts:366-384`). Disposition: `VERIFIED_FIXED`.

## Commands Codex thực thi

- Read-only: `git status --porcelain=v1 -uall`, branch/HEAD/root checks; targeted `rg`/`Get-Content`; schema/example reads của security plugin; JSON/link/diff checks sau khi viết.
- Security: một Standard scan duy nhất, ID `c7baf331-6938-498d-9d82-05a647f57395`, scope `apps/api/src`; không Deep Scan.
- Focused product tests: **0**. Static source-to-sink/counterevidence đủ để disposition; audit chủ ý không rerun full suite hoặc chạy command có thể tạo build/cache artifacts.

## Evidence taxonomy

- **Executed:** baseline Git checks; Standard Security Scan; document validation commands.
- **Static current source:** mọi finding P0–P2 và rejected candidate.
- **Documented/supporting:** 424 tests/typecheck/format/lint results từ packet; không được tái diễn giải thành current execution.
- **Unknown:** current build, integration/E2E, image start, Terraform/staging, browser behavior, production controls.

## Final artifact validation

- Exactly 10 audit files; 19 Markdown packets map 1:1 to 19 unique JSON work items và 19 unique P1/P2 finding IDs.
- JSON parse/schema-required-field check pass; mọi `rootControl.path` tồn tại và line nằm trong file.
- Relative Markdown links và 4 canonical security artifact links resolve; audit files không có trailing whitespace.
- Branch/HEAD không đổi; staged vẫn 0. Current status có 117 entries = exact original 107-entry baseline + 10 audit files. Exact baseline list delta = 0 (105 modified, 2 untracked vẫn nguyên trạng).
- Không chạy product tests/build trong final validation; evidence runtime vẫn giữ `UNKNOWN` như trên.

## Limitations

Không dùng Git history/revisions, network/web, Deep Scan, benchmark, full test rerun, sequential test-file review hay 665-warning triage. Không render UI. Standard security scan risk-based scope chỉ `apps/api/src`; parent review frontend/CI/IaC/Prisma. Production secret values, ingress, backups, object lifecycle, Redis TLS, log ACL và provider contracts không quan sát được.
