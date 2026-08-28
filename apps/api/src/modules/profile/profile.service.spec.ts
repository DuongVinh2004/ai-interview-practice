import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { UserRole, UserStatus, SessionState, CompetencyArea } from '@ai-interview/contracts';
import { BillingService } from '../billing/billing.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: any;
  let billingService: any;

  beforeEach(async () => {
    prisma = {
      userProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      interviewSession: {
        findMany: jest.fn(),
      },
    };
    billingService = {
      cancelSubscriptionsForAccountDeletion: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        { provide: BillingService, useValue: billingService },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('returns formatted profile with user details', async () => {
      const mockProfile = {
        id: 'prof-1',
        userId: 'user-1',
        fullName: 'Alex Candidate',
        targetRole: 'Fullstack Engineer',
        targetLevel: 'Senior',
        bio: 'Passionate engineer',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
        user: {
          id: 'user-1',
          email: 'alex@example.com',
          role: UserRole.CANDIDATE,
          status: UserStatus.ACTIVE,
          createdAt: new Date('2026-08-01T00:00:00Z'),
        },
      };

      prisma.userProfile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfile('user-1');
      expect(result.fullName).toBe('Alex Candidate');
      expect(result.user.email).toBe('alex@example.com');
    });
  });

  describe('updateProfile', () => {
    it('upserts and returns updated user profile', async () => {
      const updatedProfile = {
        id: 'prof-1',
        userId: 'user-1',
        fullName: 'Alex Updated',
        targetRole: 'Staff Engineer',
        targetLevel: 'Lead',
        bio: 'Tech leader',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        updatedAt: new Date('2026-08-02T00:00:00Z'),
        user: {
          id: 'user-1',
          email: 'alex@example.com',
          role: UserRole.CANDIDATE,
          status: UserStatus.ACTIVE,
          createdAt: new Date('2026-08-01T00:00:00Z'),
        },
      };

      prisma.userProfile.upsert.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile('user-1', {
        fullName: 'Alex Updated',
        targetRole: 'Staff Engineer',
        targetLevel: 'Lead',
      });

      expect(result.fullName).toBe('Alex Updated');
      expect(result.targetRole).toBe('Staff Engineer');
      expect(result.targetLevel).toBe('Lead');
    });
  });

  describe('getBenchmarks', () => {
    it('computes gap analysis and readiness percentage against senior benchmarks', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        targetLevel: 'Senior',
      });

      prisma.interviewSession.findMany.mockResolvedValue([
        {
          id: 'sess-1',
          competencyArea: CompetencyArea.SYSTEM_DESIGN,
          turns: [
            {
              question: { keyFocus: 'Distributed Cache Partitioning' },
              answer: { evaluation: { score: 9.0 } },
            },
            {
              question: { keyFocus: 'PostgreSQL Isolation & Deadlocks' },
              answer: { evaluation: { score: 8.0 } },
            },
          ],
        },
      ]);

      const result = await service.getBenchmarks('user-1');
      expect(result.targetLevel).toBe('Senior');
      expect(result.evaluatedTurnsCount).toBe(2);
      expect(result.benchmarks.length).toBe(5);
      expect(
        result.benchmarks.find(b => b.competency === CompetencyArea.SYSTEM_DESIGN)?.userScore,
      ).toBe(9.0);
      expect(result.readinessPercentage).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
    });
  });

  describe('exportUserData', () => {
    it('returns complete GDPR compliant JSON data export', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'alex@example.com',
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        profile: {
          fullName: 'Alex Candidate',
          targetRole: 'Senior Backend Engineer',
          targetLevel: 'Senior',
          bio: 'Building distributed systems',
        },
        sessions: [
          {
            id: 'sess-1',
            userId: 'user-1',
            state: SessionState.COMPLETED,
            sessionMode: 'STANDARD',
            competencyArea: null,
            isSandbox: false,
            currentTurn: 5,
            totalTurns: 5,
            targetDifficulty: 2,
            overallScore: 8.4,
            createdAt: new Date('2026-08-10T00:00:00Z'),
            updatedAt: new Date('2026-08-10T01:00:00Z'),
            jobRole: {
              id: 'role-1',
              slug: 'backend',
              name: 'Backend',
              description: '',
              isActive: true,
            },
            seniorityLevel: {
              id: 'lvl-1',
              slug: 'senior',
              name: 'Senior',
              order: 3,
              description: '',
              isActive: true,
            },
            technologies: [],
            turns: [
              {
                id: 'turn-1',
                sessionId: 'sess-1',
                turnNumber: 1,
                difficulty: 2,
                status: 'EVALUATED',
                isFollowUp: false,
                parentTurnNumber: null,
                createdAt: new Date('2026-08-10T00:01:00Z'),
                updatedAt: new Date('2026-08-10T00:05:00Z'),
                question: {
                  id: 'q-1',
                  turnId: 'turn-1',
                  content: 'Explain ACID properties.',
                  difficulty: 2,
                  keyFocus: 'ACID',
                  createdAt: new Date('2026-08-10T00:01:00Z'),
                },
                answer: {
                  id: 'ans-1',
                  turnId: 'turn-1',
                  content: 'ACID stands for Atomicity, Consistency, Isolation, Durability...',
                  submittedAt: new Date('2026-08-10T00:04:00Z'),
                  evaluation: {
                    id: 'eval-1',
                    answerId: 'ans-1',
                    score: 8.5,
                    rubricScores: { technicalAccuracy: 9.0, depth: 8.0, clarity: 8.5 },
                    strengths: ['Clear definition'],
                    improvements: ['Add isolation level detail'],
                    conciseFeedback: 'Strong answer',
                    evidence: ['Detailed atomicity'],
                    createdAt: new Date('2026-08-10T00:05:00Z'),
                  },
                },
              },
            ],
            learningPath: {
              id: 'lp-1',
              sessionId: 'sess-1',
              status: 'READY',
              summary: 'Great foundation',
              errorMessage: null,
              items: [
                {
                  id: 'item-1',
                  learningPathId: 'lp-1',
                  gap: 'Isolation Levels',
                  topic: 'Databases',
                  priority: 'HIGH',
                  recommendedAction: 'Read PostgreSQL MVCC documentation',
                  searchKeywords: ['MVCC', 'PostgreSQL'],
                  order: 1,
                  isCompleted: false,
                  completedAt: null,
                },
              ],
              createdAt: new Date('2026-08-10T01:00:00Z'),
              updatedAt: new Date('2026-08-10T01:00:00Z'),
            },
          },
        ],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userDocument = {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'doc-1',
            fileName: 'resume.pdf',
            fileType: 'application/pdf',
            status: 'PARSED',
            createdAt: new Date('2026-08-01T00:00:00Z'),
            expiresAt: new Date('2026-08-31T00:00:00Z'),
          },
        ]),
      };
      prisma.voiceSession = {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };

      const result = await service.exportUserData('user-1');
      expect(result.gdprComplianceVersion).toBe('GDPR-AIP-2026.08');
      expect(result.manifestVersion).toBe('1.0.0');
      expect(result.retentionPolicySummary).toBeDefined();
      expect(result.user.email).toBe('alex@example.com');
      expect(result.profile.fullName).toBe('Alex Candidate');
      expect(result.documents?.length).toBe(1);
      expect(result.sessions.length).toBe(1);
      expect(result.summary.completedSessionsCount).toBe(1);
      expect(result.summary.averageScore).toBe(8.4);
    });
  });

  describe('deleteAccount (GDPR Right to Erasure PRIV-002)', () => {
    it('successfully anonymizes profile, updates user status, purges documents and logs audit', async () => {
      const mockUser = {
        id: 'user-to-delete',
        email: 'user@example.com',
        profile: { id: 'prof-del', fullName: 'John Doe', bio: 'Some bio' },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update = jest.fn().mockResolvedValue({});
      prisma.userProfile = { update: jest.fn().mockResolvedValue({}) };
      prisma.userDocument = { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) };
      prisma.interviewSession = { findMany: jest.fn().mockResolvedValue([]) };
      prisma.voiceTranscript = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
      prisma.voiceSessionMetric = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
      prisma.voiceSession = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
      prisma.voiceConsentRecord = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
      prisma.refreshToken = { updateMany: jest.fn().mockResolvedValue({ count: 2 }) };
      prisma.auditLog = { create: jest.fn().mockResolvedValue({}) };
      prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));

      const result = await service.deleteAccount('user-to-delete');
      expect(result.success).toBe(true);
      expect(billingService.cancelSubscriptionsForAccountDeletion).toHaveBeenCalledWith(
        'user-to-delete',
      );
      expect(prisma.userProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-to-delete' },
        data: expect.objectContaining({ fullName: 'Deleted User', bio: null }),
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-to-delete' },
        data: expect.objectContaining({
          status: UserStatus.LOCKED,
          email: 'deleted_user-to-delete@anonymized.local',
          tokenVersion: { increment: 1 },
        }),
      });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-to-delete', isRevoked: false },
        data: { isRevoked: true },
      });

      expect(prisma.userDocument.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-to-delete' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-to-delete',
          action: 'USER_ACCOUNT_DELETED',
        }),
      });
    });
  });
});
