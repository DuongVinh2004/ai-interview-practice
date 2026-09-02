import { Test, TestingModule } from '@nestjs/testing';
import { InterviewService } from '../../src/modules/interview/interview.service';
import { QuestionBankService } from '../../src/modules/question-bank/services/question-bank.service';
import { CohortService } from '../../src/modules/b2b/services/cohort.service';
import { CohortAccessPolicy } from '../../src/modules/b2b/policies/cohort-access.policy';
import { CertificateService } from '../../src/modules/portfolio/services/certificate.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { PrismaService } from '../../src/modules/platform/prisma/prisma.service';
import { SseService } from '../../src/modules/platform/sse/sse.service';
import { AiOrchestratorService } from '../../src/modules/ai-orchestrator/ai-orchestrator.service';
import { UsageMeterService } from '../../src/modules/billing/usage-meter.service';
import { InterviewConfigurationService } from '../../src/modules/interview-configuration/interview-configuration.service';
import { QuestionBankEntitlementService } from '../../src/modules/question-bank/services/question-bank-entitlement.service';
import { EntitlementReservationService } from '../../src/modules/billing/entitlement-reservation.service';
import { SignatureService } from '../../src/modules/portfolio/services/signature.service';
import { QrCodeService } from '../../src/modules/portfolio/services/qr-code.service';
import { BadgeService } from '../../src/modules/portfolio/services/badge.service';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../src/modules/platform/filters/all-exceptions.filter';
import {
  UserRole,
  TenantRole,
  SessionState,
  CompetencyArea,
  ErrorCode,
} from '@ai-interview/contracts';
import { NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';

describe('Tier 4: Comprehensive IDOR & BOLA Security Suite (SEC-001..010)', () => {
  let interviewService: InterviewService;
  let qbService: QuestionBankService;
  let cohortService: CohortService;
  let certificateService: CertificateService;
  let storageService: StorageService;
  let mockPrisma: any;

  const USER_A_VICTIM = '11111111-1111-1111-1111-111111111111';
  const USER_B_ATTACKER = '22222222-2222-2222-2222-222222222222';
  const TENANT_A = 'tenant-alpha-org';
  const TENANT_B = 'tenant-beta-org';
  const SESSION_ID = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    mockPrisma = {
      interviewSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      questionBookmark: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest
          .fn()
          .mockResolvedValue({ id: 'bm-1', userId: USER_B_ATTACKER, questionId: 'q-target-1' }),
      },
      questionAnswerAccessGrant: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      questionBankQuestion: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'q-target-1', publicationStatus: 'PUBLISHED' }),
      },
      cohort: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      tenantMember: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      interviewTurn: {
        findMany: jest.fn(),
      },
      certificate: {
        create: jest.fn(),
      },
      fileAsset: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
    };

    const mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    } as unknown as Queue;

    const mockStorageProvider = {
      getPresignedUploadUrl: jest.fn(),
      getPresignedDownloadUrl: jest.fn(),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      headObject: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewService,
        QuestionBankService,
        CohortService,
        CohortAccessPolicy,
        CertificateService,
        StorageService,
        SignatureService,
        QrCodeService,
        BadgeService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: SseService,
          useValue: { emitSessionEvent: jest.fn() },
        },
        {
          provide: AiOrchestratorService,
          useValue: {},
        },
        {
          provide: UsageMeterService,
          useValue: {
            checkAndConsumeQuotaInTransaction: jest.fn(),
            consumeQuotaDirect: jest.fn(),
            refundQuota: jest.fn(),
          },
        },
        {
          provide: InterviewConfigurationService,
          useValue: {},
        },
        {
          provide: QuestionBankEntitlementService,
          useValue: {
            getEffectiveEntitlement: jest.fn().mockResolvedValue({
              tier: 'PRO',
              monthlyQuestionRevealLimit: 50,
              revealsUsedThisMonth: 5,
              accessPeriodKey: 'month_2026-09',
            }),
          },
        },
        {
          provide: EntitlementReservationService,
          useValue: {
            reserve: jest.fn().mockResolvedValue({ id: 'res-1', status: 'PENDING' }),
            commit: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: 'STORAGE_PROVIDER',
          useValue: mockStorageProvider,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key === 'jwt.accessSecret') return 'test-sec';
              return def ?? null;
            }),
          },
        },
        { provide: 'BullQueue_question-generation', useValue: mockQueue },
        { provide: 'BullQueue_answer-evaluation', useValue: mockQueue },
      ],
    }).compile();

    interviewService = module.get<InterviewService>(InterviewService);
    qbService = module.get<QuestionBankService>(QuestionBankService);
    cohortService = module.get<CohortService>(CohortService);
    certificateService = module.get<CertificateService>(CertificateService);
    storageService = module.get<StorageService>(StorageService);
  });

  describe('Block A: Interview Session IDOR/BOLA Protection', () => {
    it('A1. getSession rejects cross-user read access for normal candidate with 403 Forbidden', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        userId: USER_A_VICTIM,
        state: SessionState.ACTIVE,
        turns: [],
      });

      await expect(
        interviewService.getSession(USER_B_ATTACKER, UserRole.CANDIDATE, SESSION_ID),
      ).rejects.toThrow(DomainException);
    });

    it('A2. submitAnswer rejects cross-user answer submission with 403 Forbidden', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        userId: USER_A_VICTIM,
        state: SessionState.ACTIVE,
        turns: [
          {
            id: 'turn-1',
            turnNumber: 1,
            question: { content: 'Explain ACID' },
            answer: null,
          },
        ],
      });

      await expect(
        interviewService.submitAnswer(USER_B_ATTACKER, SESSION_ID, {
          turnId: 'turn-1',
          answerText: 'Hacked answer by attacker',
        }),
      ).rejects.toThrow(DomainException);
    });

    it('A3. getSessionStatus rejects cross-user status polling with 403 Forbidden', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        userId: USER_A_VICTIM,
        state: SessionState.ACTIVE,
        currentTurn: 1,
        totalTurns: 5,
        turns: [{ turnNumber: 1, status: 'ASKED' }],
        overallScore: null,
        updatedAt: new Date(),
      });

      await expect(
        interviewService.getSessionStatus(USER_B_ATTACKER, UserRole.CANDIDATE, SESSION_ID),
      ).rejects.toThrow(DomainException);
    });

    it('A4. assertSessionAccess fails for non-owner and unverified admin', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        userId: USER_A_VICTIM,
      });

      // User B cannot access
      await expect(
        interviewService.assertSessionAccess(USER_B_ATTACKER, UserRole.CANDIDATE, SESSION_ID),
      ).rejects.toThrow(DomainException);

      // Admin without MFA verification cannot access
      await expect(
        interviewService.assertSessionAccess(USER_B_ATTACKER, UserRole.ADMIN, SESSION_ID, false),
      ).rejects.toThrow(DomainException);
    });

    it('A5. reEvaluateTurn rejects cross-user re-evaluation requests', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        userId: USER_A_VICTIM,
        state: SessionState.ACTIVE,
      });

      await expect(
        interviewService.reEvaluateTurn(USER_B_ATTACKER, UserRole.CANDIDATE, SESSION_ID, 1, {
          reason: 'Check again',
        }),
      ).rejects.toThrow(DomainException);
    });

    it('A6. Owner user CAN access their own session without issues', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValue({
        id: SESSION_ID,
        userId: USER_A_VICTIM,
        state: SessionState.ACTIVE,
        currentTurn: 1,
        totalTurns: 5,
        turns: [],
        jobRole: { name: 'Backend' },
        seniorityLevel: { name: 'Senior' },
        technologies: [],
        learningPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const session = await interviewService.getSession(
        USER_A_VICTIM,
        UserRole.CANDIDATE,
        SESSION_ID,
      );
      expect(session).toBeDefined();
      expect(session.id).toBe(SESSION_ID);
    });
  });

  describe('Block B: Question Bank Bookmark & Reveal IDOR Isolation', () => {
    it('B1. listBookmarks strictly queries with authenticated requester userId', async () => {
      mockPrisma.questionBookmark.count.mockResolvedValue(0);
      mockPrisma.questionBookmark.findMany.mockResolvedValue([]);
      mockPrisma.questionAnswerAccessGrant.findMany.mockResolvedValue([]);

      await qbService.listBookmarks(USER_B_ATTACKER, { page: 1, limit: 10 });

      expect(mockPrisma.questionBookmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_B_ATTACKER },
        }),
      );
    });

    it('B2. removeBookmark deletes only records matching authenticated userId', async () => {
      mockPrisma.questionBookmark.deleteMany.mockResolvedValue({ count: 1 });

      await qbService.removeBookmark('q-target-1', USER_B_ATTACKER);

      expect(mockPrisma.questionBookmark.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: USER_B_ATTACKER,
          questionId: 'q-target-1',
        },
      });
    });

    it('B3. addBookmark associates the bookmark exclusively with requesting userId', async () => {
      mockPrisma.questionBankQuestion.findUnique = jest.fn().mockResolvedValue({
        id: 'q-target-1',
        status: 'PUBLISHED',
      });

      await qbService.addBookmark('q-target-1', USER_B_ATTACKER);

      expect(mockPrisma.questionBookmark.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId: USER_B_ATTACKER,
            questionId: 'q-target-1',
          }),
        }),
      );
    });
  });

  describe('Block C: B2B Multi-Tenant Isolation & Policy Enforcement', () => {
    it('C1. listCohorts strictly filters cohorts by tenantId', async () => {
      mockPrisma.cohort.findMany.mockResolvedValue([
        {
          id: 'cohort-1',
          tenantId: TENANT_A,
          name: 'Spring 2026 Cohort',
          description: null,
          isActive: true,
          members: [],
          assignments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await cohortService.listCohorts(TENANT_A);
      expect(mockPrisma.cohort.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('C2. getCohort throws NotFoundException when accessing cohort from different tenant', async () => {
      mockPrisma.cohort.findFirst.mockResolvedValue(null);

      await expect(
        cohortService.getCohort('cohort-in-tenant-a', {
          userId: USER_B_ATTACKER,
          tenantId: TENANT_B,
          tenantRole: TenantRole.INSTRUCTOR,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('C3. CohortAccessPolicy enforces STUDENT scope to only cohorts where student is a member', () => {
      const policy = new CohortAccessPolicy();
      const predicate = policy.buildReadPredicate('cohort-1', {
        userId: 'student-1',
        tenantId: TENANT_A,
        tenantRole: TenantRole.STUDENT,
      });

      expect(predicate.id).toBe('cohort-1');
      expect(predicate.tenantId).toBe(TENANT_A);
      expect(predicate.members).toBeDefined();
      expect(predicate.members.some.tenantMember.is.userId).toBe('student-1');
    });
  });

  describe('Block D: Portfolio & Certificate IDOR', () => {
    it('D1. generateCertificate enforces authoritative evaluations exclusively belonging to user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: USER_B_ATTACKER,
        profile: { fullName: 'Attacker' },
      });

      mockPrisma.interviewTurn.findMany.mockResolvedValue([]);

      await expect(
        certificateService.generateCertificate(USER_B_ATTACKER, CompetencyArea.SYSTEM_DESIGN),
      ).rejects.toThrow();

      expect(mockPrisma.interviewTurn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            session: expect.objectContaining({ userId: USER_B_ATTACKER }),
          }),
        }),
      );
    });
  });

  describe('Block E: Storage Service Object Isolation', () => {
    it('E1. deleteFile prevents non-admin user from deleting files owned by other users', async () => {
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'fa-victim',
        userId: USER_A_VICTIM,
        key: `documents/${USER_A_VICTIM}/private-cv.pdf`,
      });

      await expect(
        storageService.deleteFile(
          USER_B_ATTACKER,
          `documents/${USER_A_VICTIM}/private-cv.pdf`,
          UserRole.CANDIDATE,
        ),
      ).rejects.toThrow(DomainException);
    });

    it('E2. deleteFile permits owner to delete their own file', async () => {
      mockPrisma.fileAsset.findUnique.mockResolvedValue({
        id: 'fa-my',
        userId: USER_A_VICTIM,
        key: `documents/${USER_A_VICTIM}/my-cv.pdf`,
      });
      mockPrisma.fileAsset.delete.mockResolvedValue({});

      await expect(
        storageService.deleteFile(
          USER_A_VICTIM,
          `documents/${USER_A_VICTIM}/my-cv.pdf`,
          UserRole.CANDIDATE,
        ),
      ).resolves.toBeUndefined();
    });
  });
});
