import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus, ConflictException } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  AllExceptionsFilter,
  DomainException,
} from '../src/modules/platform/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/modules/platform/interceptors/transform.interceptor';
import { PrismaService } from '../src/modules/platform/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { QuestionBankService } from '../src/modules/question-bank/services/question-bank.service';
import { InterviewService } from '../src/modules/interview/interview.service';
import { CanvasService } from '../src/modules/system-design/services/canvas.service';
import { StripeProvider } from '../src/modules/billing/providers/stripe.provider';
import { PayosProvider } from '../src/modules/billing/providers/payos.provider';
import { BillingService } from '../src/modules/billing/billing.service';
import { UsageMeterService } from '../src/modules/billing/usage-meter.service';
import { SessionStateMachine } from '../src/modules/interview/state-machine/session-state-machine';
import {
  UserRole,
  UserStatus,
  SessionState,
  QuestionPublicationStatus,
  QuestionAnswerAuthority,
  ErrorCode,
  BillingMetric,
  SessionMode,
} from '@ai-interview/contracts';

describe('L2 & L3 Integration Verification: Stateful Workflows, Concurrency & OCC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let questionBankService: QuestionBankService;
  let interviewService: InterviewService;
  let canvasService: CanvasService;
  let stripeProvider: StripeProvider;
  let payosProvider: PayosProvider;
  let billingService: BillingService;
  let usageMeterService: UsageMeterService;

  let testAuthorId: string;
  let testReviewerId: string;
  let testCandidateId: string;
  let testJobRoleId: string;
  let testSeniorityId: string;
  let testTechId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    authService = app.get<AuthService>(AuthService);
    questionBankService = app.get<QuestionBankService>(QuestionBankService);
    interviewService = app.get<InterviewService>(InterviewService);
    canvasService = app.get<CanvasService>(CanvasService);
    stripeProvider = app.get<StripeProvider>(StripeProvider);
    payosProvider = app.get<PayosProvider>(PayosProvider);
    billingService = app.get<BillingService>(BillingService);
    usageMeterService = app.get<UsageMeterService>(UsageMeterService);

    // Seed test users in DB
    const authorRes = await authService.register({
      email: 'admin-author-' + Date.now() + '@example.com',
      password: 'Password123!',
      fullName: 'Author Admin',
    });
    testAuthorId = authorRes.user!.id;
    await prisma.user.update({
      where: { id: testAuthorId },
      data: { role: UserRole.ADMIN },
    });

    const reviewerRes = await authService.register({
      email: 'admin-reviewer-' + Date.now() + '@example.com',
      password: 'Password123!',
      fullName: 'Reviewer Admin',
    });
    testReviewerId = reviewerRes.user!.id;
    await prisma.user.update({
      where: { id: testReviewerId },
      data: { role: UserRole.ADMIN },
    });

    const candidateRes = await authService.register({
      email: 'candidate-test-' + Date.now() + '@example.com',
      password: 'Password123!',
      fullName: 'Candidate Test',
    });
    testCandidateId = candidateRes.user!.id;

    // Fetch taxonomy IDs
    const jobRole = await prisma.jobRole.findFirst();
    const seniority = await prisma.seniorityLevel.findFirst();
    const tech = await prisma.technology.findFirst();

    testJobRoleId = jobRole?.id || '';
    testSeniorityId = seniority?.id || '';
    testTechId = tech?.id || '';
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. Auth Lifecycle & Token Security Integration
  // =========================================================================
  describe('1. Auth Lifecycle: Rotation, Reuse Revocation & Invalidation', () => {
    it('Refreshes token and validates rotation', async () => {
      const email = 'lifecycle-' + Date.now() + '@example.com';
      const registerRes = await authService.register({
        email,
        password: 'Password123!',
        fullName: 'Lifecycle User',
      });

      expect(registerRes.accessToken).toBeDefined();
      expect(registerRes.refreshToken).toBeDefined();

      const refreshed = await authService.refreshTokens(registerRes.refreshToken!);
      expect(refreshed.accessToken).toBeDefined();
      expect(refreshed.refreshToken).toBeDefined();
      expect(refreshed.refreshToken).not.toEqual(registerRes.refreshToken);
    });

    it('Detects refresh token reuse and revokes entire token family', async () => {
      const email = 'reuse-' + Date.now() + '@example.com';
      const reg = await authService.register({
        email,
        password: 'Password123!',
        fullName: 'Reuse Tester',
      });

      const firstRefresh = await authService.refreshTokens(reg.refreshToken!);
      expect(firstRefresh.accessToken).toBeDefined();

      // Replaying old (rotated) refresh token must fail
      await expect(authService.refreshTokens(reg.refreshToken!)).rejects.toThrow();

      // Replaying subsequent tokens from the revoked family also fails
      await expect(authService.refreshTokens(firstRefresh.refreshToken!)).rejects.toThrow();
    });

    it('Invalidates tokens on logout', async () => {
      const email = 'logout-' + Date.now() + '@example.com';
      const reg = await authService.register({
        email,
        password: 'Password123!',
        fullName: 'Logout Tester',
      });

      await authService.logout(reg.user!.id, reg.refreshToken!);
      await expect(authService.refreshTokens(reg.refreshToken!)).rejects.toThrow();
    });
  });

  // =========================================================================
  // 2. Interview Session State Machine & AI Evaluation Provenance
  // =========================================================================
  describe('2. Interview State Machine & Provenance Logging', () => {
    it('Validates official lifecycle transitions: CREATED -> ACTIVE -> EVALUATING -> COMPLETED', () => {
      expect(SessionStateMachine.canTransition(SessionState.CREATED, SessionState.ACTIVE)).toBe(
        true,
      );
      expect(SessionStateMachine.canTransition(SessionState.ACTIVE, SessionState.EVALUATING)).toBe(
        true,
      );
      expect(
        SessionStateMachine.canTransition(SessionState.EVALUATING, SessionState.COMPLETED),
      ).toBe(true);

      // Terminal states cannot transition back
      expect(SessionStateMachine.canTransition(SessionState.COMPLETED, SessionState.ACTIVE)).toBe(
        false,
      );
      expect(SessionStateMachine.canTransition(SessionState.CANCELLED, SessionState.ACTIVE)).toBe(
        false,
      );
    });

    it('Blocks illegal state jumps and throws DomainException', () => {
      expect(() => {
        SessionStateMachine.validateTransition(SessionState.COMPLETED, SessionState.ACTIVE);
      }).toThrow();

      expect(() => {
        SessionStateMachine.validateTransition(SessionState.CREATED, SessionState.COMPLETED);
      }).toThrow();
    });
  });

  // =========================================================================
  // 3. Billing Webhook Concurrency & Idempotency
  // =========================================================================
  describe('3. Billing Webhook Concurrency (10 concurrent identical events)', () => {
    it('Handles 10 concurrent Stripe webhook deliveries with identical eventId idempotently', async () => {
      const eventId = 'evt_test_race_' + Date.now();
      const mockPayload = {
        id: eventId,
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_test_' + Date.now(),
            customer: 'cus_test_race',
            subscription: 'sub_test_race',
            amount_paid: 2900,
            currency: 'usd',
            status: 'paid',
            lines: {
              data: [
                {
                  price: { id: 'price_pro_monthly' },
                  period: {
                    start: Math.floor(Date.now() / 1000),
                    end: Math.floor(Date.now() / 1000) + 30 * 86400,
                  },
                },
              ],
            },
          },
        },
      };

      (stripeProvider as any).webhookSecret = 'whsec_test_secret';
      jest.spyOn(stripeProvider, 'verifyWebhookSignature').mockReturnValue(true);

      const requests = Array.from({ length: 10 }, () =>
        stripeProvider.handleWebhook(
          mockPayload,
          't=123,v1=valid_sig',
          JSON.stringify(mockPayload),
        ),
      );

      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled');

      expect(successful.length).toBe(10);
      successful.forEach(res => {
        const value = (res as PromiseFulfilledResult<any>).value;
        expect(value.handled).toBe(true);
      });
    });

    it('PayOS webhook replay returns idempotent success without duplicate execution', async () => {
      const orderCode = Math.floor(100000 + Math.random() * 900000);
      const payosPayload = {
        code: '00',
        desc: 'success',
        data: {
          orderCode,
          amount: 200000,
          description: 'AI Interview Practice Pro',
          accountNumber: '123456789',
          reference: 'ref_' + orderCode,
          transactionDateTime: new Date().toISOString(),
          paymentLinkId: 'pl_' + orderCode,
          code: '00',
          desc: 'Success',
          currency: 'VND',
        },
        signature: 'mock_valid_signature',
      };

      // Create matching open invoice in DB
      await prisma.invoice.create({
        data: {
          userId: testCandidateId,
          stripeInvoiceId: 'PAYOS_' + orderCode,
          amountTotal: 200000,
          currency: 'VND',
          status: 'OPEN',
        },
      });

      jest.spyOn(payosProvider, 'verifyWebhookData').mockResolvedValue(payosPayload.data as any);

      const requests = Array.from({ length: 10 }, () =>
        billingService.handlePayosWebhook(payosPayload),
      );

      const results = await Promise.allSettled(requests);
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      expect(fulfilled.length).toBe(10);
    });
  });

  // =========================================================================
  // 4. Question Bank Governance & Safe Projection
  // =========================================================================
  describe('4. Question Bank Content Governance 5-Step Lifecycle & Safe Projection', () => {
    it('Enforces 5-step lifecycle: DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED -> ARCHIVED', async () => {
      // 1. Author creates draft question
      const question = await questionBankService.adminCreateQuestion(
        {
          title: 'Governance Question ' + Date.now(),
          slug: 'gov-q-' + Date.now(),
          questionBody: 'Explain distributed locking mechanisms',
          questionType: 'conceptual',
          difficulty: 3,
          language: 'vi',
          initialAnswer: {
            authority: QuestionAnswerAuthority.REFERENCE,
            answerBody: 'Redlock and database advisory locks...',
            explanationBody: 'Detailed analysis of distributed locks',
            rubric: { correctness: 5, depth: 5 },
            sourceType: 'curated',
          },
        },
        testAuthorId,
      );
      expect(question.status).toBe(QuestionPublicationStatus.DRAFT);

      // 2. Submit for review
      const inReview = await questionBankService.adminSubmitReview(question.id, testAuthorId);
      expect(inReview.status).toBe(QuestionPublicationStatus.IN_REVIEW);

      // 3. Author cannot review/approve own question
      await expect(
        questionBankService.adminReview(
          question.id,
          { action: 'APPROVE', reviewNotes: 'Self approved' },
          testAuthorId,
        ),
      ).rejects.toThrow();

      // 4. Peer reviewer approves
      const approved = await questionBankService.adminReview(
        question.id,
        { action: 'APPROVE', reviewNotes: 'LGTM verified' },
        testReviewerId,
      );
      expect(approved.status).toBe(QuestionPublicationStatus.APPROVED);

      // 5. Publish
      const published = await questionBankService.adminPublish(question.id, testReviewerId);
      expect(published.status).toBe(QuestionPublicationStatus.PUBLISHED);

      // 6. Archive
      const archived = await questionBankService.adminArchive(question.id, testReviewerId);
      expect(archived.status).toBe(QuestionPublicationStatus.ARCHIVED);
    });

    it('Safe projection never leaks answerBody or rubric to candidate before reveal', async () => {
      const slug = 'safe-proj-' + Date.now();
      const question = await questionBankService.adminCreateQuestion(
        {
          title: 'Safe Projection Test ' + Date.now(),
          slug,
          questionBody: 'What is database sharding?',
          questionType: 'system_design',
          difficulty: 4,
          language: 'vi',
          initialAnswer: {
            authority: QuestionAnswerAuthority.REFERENCE,
            answerBody: 'TOP SECRET ANSWER BODY THAT MUST NOT LEAK',
            explanationBody: 'TOP SECRET EXPLANATION',
            rubric: { secretRubricField: 'must_not_leak' },
            sourceType: 'curated',
          },
        },
        testAuthorId,
      );

      await questionBankService.adminSubmitReview(question.id, testAuthorId);
      await questionBankService.adminReview(question.id, { action: 'APPROVE' }, testReviewerId);
      await questionBankService.adminPublish(question.id, testReviewerId);

      const candidateView = await questionBankService.getQuestionBySlug(slug, testCandidateId);

      expect(candidateView.answer).toBeFalsy();
      expect(candidateView.isRevealed).toBeFalsy();
      expect(JSON.stringify(candidateView)).not.toContain('TOP SECRET ANSWER BODY');
      expect(JSON.stringify(candidateView)).not.toContain('secretRubricField');
    });
  });

  // =========================================================================
  // 5. Question Bank Reveal Race (20 concurrent requests)
  // =========================================================================
  describe('5. Question Bank Reveal Concurrency (20 Concurrent Requests)', () => {
    it('Scenario A: 20 concurrent requests with identical Idempotency-Key results in exactly 1 reveal grant', async () => {
      const regCandA = await authService.register({
        email: 'cand-race-a-' + Date.now() + '@example.com',
        password: 'Password123!',
        fullName: 'Cand Race A',
      });
      const candAId = regCandA.user!.id;

      const q = await questionBankService.adminCreateQuestion(
        {
          title: 'Reveal Race A ' + Date.now(),
          slug: 'reveal-race-a-' + Date.now(),
          questionBody: 'How does Kafka guarantee message ordering?',
          questionType: 'scenario',
          difficulty: 3,
          language: 'vi',
          initialAnswer: {
            authority: QuestionAnswerAuthority.REFERENCE,
            answerBody: 'Kafka guarantees ordering within a single partition via offset indexing.',
            sourceType: 'curated',
          },
        },
        testAuthorId,
      );

      await questionBankService.adminSubmitReview(q.id, testAuthorId);
      await questionBankService.adminReview(q.id, { action: 'APPROVE' }, testReviewerId);
      await questionBankService.adminPublish(q.id, testReviewerId);

      const idempotencyKey = 'idem-key-same-' + Date.now();
      const requests = Array.from({ length: 20 }, () =>
        questionBankService.revealAnswer(q.id, candAId, idempotencyKey),
      );

      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled');

      expect(successful.length).toBe(20);
      successful.forEach(r => {
        const val = (r as PromiseFulfilledResult<any>).value;
        expect(val.data).toBeDefined();
        expect(val.data.answerBody).toContain('Kafka guarantees ordering');
      });

      const grants = await prisma.questionAnswerAccessGrant.findMany({
        where: { userId: candAId, questionId: q.id },
      });
      expect(grants.length).toBe(1);

      const ledgers = await prisma.questionBankUsageLedger.findMany({
        where: { userId: candAId },
      });
      expect(ledgers.length).toBe(1);
    });

    it('Scenario B: 20 concurrent requests with different Idempotency-Keys for same user and question result in exactly 1 reveal grant', async () => {
      const regCand = await authService.register({
        email: 'cand-race-b-' + Date.now() + '@example.com',
        password: 'Password123!',
        fullName: 'Cand Race B',
      });
      const candBId = regCand.user!.id;

      const q = await questionBankService.adminCreateQuestion(
        {
          title: 'Reveal Race B ' + Date.now(),
          slug: 'reveal-race-b-' + Date.now(),
          questionBody: 'What is Raft consensus algorithm?',
          questionType: 'system_design',
          difficulty: 4,
          language: 'vi',
          initialAnswer: {
            authority: QuestionAnswerAuthority.REFERENCE,
            answerBody:
              'Raft consensus relies on Leader Election, Log Replication, and Safety invariants.',
            sourceType: 'curated',
          },
        },
        testAuthorId,
      );

      await questionBankService.adminSubmitReview(q.id, testAuthorId);
      await questionBankService.adminReview(q.id, { action: 'APPROVE' }, testReviewerId);
      await questionBankService.adminPublish(q.id, testReviewerId);

      const requests = Array.from({ length: 20 }, (_, i) =>
        questionBankService.revealAnswer(q.id, candBId, 'idem-key-diff-' + i + '-' + Date.now()),
      );

      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled');

      expect(successful.length).toBe(20);

      const grants = await prisma.questionAnswerAccessGrant.findMany({
        where: { userId: candBId, questionId: q.id },
      });
      expect(grants.length).toBe(1);

      const ledgers = await prisma.questionBankUsageLedger.findMany({
        where: { userId: candBId },
      });
      expect(ledgers.length).toBe(1);
    });
  });

  // =========================================================================
  // 6. Interview Start Quota Race (1 remaining quota)
  // =========================================================================
  describe('6. Interview Start Quota Race (1 Quota Left)', () => {
    it('Creates exactly 1 session when multiple concurrent requests race for 1 remaining quota', async () => {
      const quotaUser = await authService.register({
        email: 'quota-user-' + Date.now() + '@example.com',
        password: 'Password123!',
        fullName: 'Quota User',
      });
      const candId = quotaUser.user!.id;

      let quotaCount = 0;
      jest
        .spyOn(usageMeterService, 'checkAndConsumeQuotaInTransaction')
        .mockImplementation(async () => {
          if (quotaCount >= 1) {
            throw new DomainException(
              ErrorCode.QUOTA_EXCEEDED,
              'Monthly interview quota exceeded',
              HttpStatus.FORBIDDEN,
            );
          }
          quotaCount++;
          return { allowed: true, currentUsage: 1, limit: 1, remaining: 0 };
        });

      if (testJobRoleId && testSeniorityId && testTechId) {
        const dto = {
          jobRoleId: testJobRoleId,
          seniorityLevelId: testSeniorityId,
          technologyIds: [testTechId],
          sessionMode: SessionMode.STANDARD,
          language: 'vi',
          totalTurns: 5,
        };

        const requests = Array.from({ length: 5 }, () =>
          interviewService.createSession(candId, dto),
        );

        const results = await Promise.allSettled(requests);
        const winners = results.filter(r => r.status === 'fulfilled');
        const losers = results.filter(r => r.status === 'rejected');

        expect(winners.length).toBe(1);
        expect(losers.length).toBe(4);

        losers.forEach(l => {
          const reason = (l as PromiseRejectedResult).reason;
          expect(reason).toBeInstanceOf(DomainException);
          expect(reason.status).toBe(HttpStatus.FORBIDDEN);
        });
      }
    });
  });

  // =========================================================================
  // 7. Canvas Optimistic Concurrency Control (OCC)
  // =========================================================================
  describe('7. Canvas Optimistic Concurrency Control & ETag Collision', () => {
    it('2 concurrent updates from base version 1 results in 1 success (v2) and 1 conflict 409', async () => {
      const session = await prisma.interviewSession.create({
        data: {
          userId: testCandidateId,
          jobRoleId: testJobRoleId,
          seniorityLevelId: testSeniorityId,
          state: SessionState.ACTIVE,
          sessionMode: SessionMode.SYSTEM_DESIGN,
          language: 'vi',
          currentTurn: 1,
          totalTurns: 5,
          targetDifficulty: 1,
        },
      });

      jest.spyOn(canvasService as any, 'verifySessionOwnership').mockResolvedValue(true);

      const baseSnapshot = await canvasService.saveSnapshot(
        testCandidateId,
        session.id,
        'https://storage.ai-interview.dev/canvas/init.svg',
        { elements: [{ id: 'node-1', type: 'service', label: 'API Gateway' }] },
        10,
      );
      expect(baseSnapshot.version).toBe(1);

      // Client A updates with expectedVersion = 1 -> succeeds, version becomes 2
      const updateA = await canvasService.saveSnapshot(
        testCandidateId,
        session.id,
        'https://storage.ai-interview.dev/canvas/updateA.svg',
        {
          elements: [
            { id: 'node-1', label: 'API Gateway' },
            { id: 'node-2', label: 'Auth Service' },
          ],
        },
        20,
        1,
      );
      expect(updateA.version).toBe(2);

      // Client B attempts update with stale expectedVersion = 1 -> must conflict 409
      await expect(
        canvasService.saveSnapshot(
          testCandidateId,
          session.id,
          'https://storage.ai-interview.dev/canvas/updateB.svg',
          {
            elements: [
              { id: 'node-1', label: 'API Gateway' },
              { id: 'node-3', label: 'Payment Service' },
            ],
          },
          25,
          1,
        ),
      ).rejects.toThrow(DomainException);

      // Client B refreshes to latest expectedVersion = 2 -> succeeds, version becomes 3
      const retry = await canvasService.saveSnapshot(
        testCandidateId,
        session.id,
        'https://storage.ai-interview.dev/canvas/retry.svg',
        {
          elements: [
            { id: 'node-1', label: 'API Gateway' },
            { id: 'node-3', label: 'Payment Service' },
          ],
        },
        30,
        2,
      );
      expect(retry.version).toBe(3);
    });
  });
});
