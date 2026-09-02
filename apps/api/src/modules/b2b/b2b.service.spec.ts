import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './services/tenant.service';
import { CohortService } from './services/cohort.service';
import { AssignmentService } from './services/assignment.service';
import { CohortAnalyticsService } from './services/cohort-analytics.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { TenantRole, AssignmentStatus, CompetencyArea, UserRole } from '@ai-interview/contracts';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CohortAccessPolicy } from './policies/cohort-access.policy';

describe('Track F011: B2B Multi-Tenant Dashboard Module', () => {
  let tenantService: TenantService;
  let cohortService: CohortService;
  let assignmentService: AssignmentService;
  let cohortAnalyticsService: CohortAnalyticsService;
  let prisma: any;

  const mockPrisma = {
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tenantMember: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    tenantApiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    cohort: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    cohortMember: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    assignment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        CohortService,
        AssignmentService,
        CohortAnalyticsService,
        CohortAccessPolicy,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    tenantService = module.get<TenantService>(TenantService);
    cohortService = module.get<CohortService>(CohortService);
    assignmentService = module.get<AssignmentService>(AssignmentService);
    cohortAnalyticsService = module.get<CohortAnalyticsService>(CohortAnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('1. Tenant Isolation & Custom Branding', () => {
    it('creates organization tenant and assigns creator as TENANT_ADMIN', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme Tech Bootcamp',
        slug: 'acme-bootcamp',
        brandingConfig: { primaryColor: '#059669', accentColor: '#10b981' },
        isActive: true,
      });
      mockPrisma.tenantMember.create.mockResolvedValue({
        id: 'member-1',
        tenantId: 'tenant-1',
        userId: 'user-admin-1',
        role: TenantRole.TENANT_ADMIN,
      });

      const tenant = await tenantService.createTenant('user-admin-1', {
        name: 'Acme Tech Bootcamp',
        slug: 'acme-bootcamp',
        brandingConfig: { primaryColor: '#059669', accentColor: '#10b981' },
      });

      expect(tenant.id).toBe('tenant-1');
      expect(mockPrisma.tenantMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            userId: 'user-admin-1',
            role: TenantRole.TENANT_ADMIN,
          }),
        }),
      );
    });

    it('rejects duplicate slug registration', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'existing-tenant',
        slug: 'acme-bootcamp',
      });

      await expect(
        tenantService.createTenant('user-admin-1', {
          name: 'Acme Duplicate',
          slug: 'acme-bootcamp',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('generates secure hashed API key for LMS integration', async () => {
      mockPrisma.tenantApiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: 'key-1', createdAt: new Date() }),
      );

      const apiKey = await tenantService.createApiKey('tenant-1', 'Canvas LMS Webhook');
      expect(apiKey.id).toBe('key-1');
      expect(apiKey.apiKey).toMatch(/^sk_live_[a-f0-9]{48}$/);
    });
  });

  describe('2. Cohort Management & Bulk CSV Roster Import', () => {
    it('parses CSV roster, provisions accounts, and enrolls students into cohort', async () => {
      const tenantId = 'tenant-1';
      const cohortId = 'cohort-1';
      const csvData = `email,fullName,role
student1@university.edu,"Alice Johnson",STUDENT
student2@university.edu,"Bob Smith",STUDENT
invalid-email,"Bad Line",STUDENT`;

      mockPrisma.cohort.findFirst.mockResolvedValue({
        id: cohortId,
        tenantId,
        name: 'Batch 2026 Spring',
      });

      // User lookups
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `user-${data.email}`, email: data.email }),
      );

      mockPrisma.tenantMember.findUnique.mockResolvedValue(null);
      mockPrisma.tenantMember.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `tm-${data.userId}`, ...data }),
      );

      mockPrisma.cohortMember.findUnique.mockResolvedValue(null);
      mockPrisma.cohortMember.create.mockResolvedValue({ id: 'cm-1' });

      const result = await cohortService.importRosterCsv(
        cohortId,
        tenantId,
        csvData,
        TenantRole.TENANT_ADMIN,
      );
      expect(result.totalImported).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.skippedCount).toBe(1); // 1 invalid email
      expect(result.errors.length).toBe(1);
    });

    it('does not allow an instructor CSV import to mint instructor memberships', async () => {
      const result = await cohortService.importRosterCsv(
        'cohort-1',
        'tenant-1',
        'email,fullName,role\nnew-instructor@example.com,Instructor,INSTRUCTOR',
        TenantRole.INSTRUCTOR,
      );
      expect(result.successCount).toBe(0);
      expect(result.errors[0]).toContain('Only tenant administrators');
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('allows an instructor to import students but requires an actor role', async () => {
      mockPrisma.cohort.findFirst.mockResolvedValue({
        id: 'cohort-1',
        tenantId: 'tenant-1',
        name: 'Batch',
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'student-1', email: 'student@example.com' });
      mockPrisma.tenantMember.findUnique.mockResolvedValue(null);
      mockPrisma.tenantMember.create.mockResolvedValue({
        id: 'member-1',
        tenantId: 'tenant-1',
        userId: 'student-1',
        role: TenantRole.STUDENT,
      });
      mockPrisma.cohortMember.findUnique.mockResolvedValue(null);
      mockPrisma.cohortMember.create.mockResolvedValue({ id: 'cm-1' });

      const result = await cohortService.importRosterCsv(
        'cohort-1',
        'tenant-1',
        'email,fullName,role\nstudent@example.com,Student,STUDENT',
        TenantRole.INSTRUCTOR,
      );
      expect(result.successCount).toBe(1);

      await expect(
        cohortService.importRosterCsv('cohort-1', 'tenant-1', 'email,fullName\na@b.com,A'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Assignment Creation & Publishing', () => {
    it('creates interview assignment for cohort and publishes it', async () => {
      const tenantId = 'tenant-1';
      const cohortId = 'cohort-1';

      mockPrisma.cohort.findFirst.mockResolvedValue({
        id: cohortId,
        tenantId,
      });

      mockPrisma.assignment.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: 'assign-1' }),
      );

      const assignment = await assignmentService.createAssignment(cohortId, tenantId, {
        cohortId,
        title: 'Midterm System Design Mock',
        description: 'Design distributed cache',
      });

      expect(assignment.id).toBe('assign-1');
      expect(assignment.status).toBe(AssignmentStatus.DRAFT);

      // Publish
      mockPrisma.assignment.findUnique.mockResolvedValue({
        id: 'assign-1',
        cohort: { tenantId },
      });
      mockPrisma.assignment.update.mockResolvedValue({
        id: 'assign-1',
        status: AssignmentStatus.PUBLISHED,
      });

      const published = await assignmentService.publishAssignment(
        'assign-1',
        tenantId,
        AssignmentStatus.PUBLISHED,
      );
      expect(published.status).toBe(AssignmentStatus.PUBLISHED);
    });
  });

  describe('4. Cohort Analytics & Skill Heatmap', () => {
    it('aggregates cohort performance metrics, distribution, and skill heatmap', async () => {
      const tenantId = 'tenant-1';
      const cohortId = 'cohort-1';

      mockPrisma.cohort.findFirst.mockResolvedValue({
        id: cohortId,
        tenantId,
        name: 'Senior Batch 2026',
        members: [
          {
            id: 'cm-1',
            tenantMember: {
              userId: 'u-1',
              user: {
                id: 'u-1',
                email: 'top@test.com',
                profile: { fullName: 'Top Student' },
                sessions: [
                  {
                    tenantId,
                    overallScore: 9.2,
                    completedAt: new Date(),
                    turns: [
                      {
                        status: 'EVALUATED',
                        question: { keyFocus: 'Load balancing' },
                        answer: {
                          evaluation: {
                            score: 9.2,
                            authorityState: 'AUTHORITATIVE',
                            needsReview: false,
                            provider: 'openai',
                            evidence: ['verified rubric evidence'],
                          },
                        },
                      },
                    ],
                  },
                ],
                readinessSnapshots: [{ readinessScore: 94 }],
              },
            },
          },
          {
            id: 'cm-2',
            tenantMember: {
              userId: 'u-2',
              user: {
                id: 'u-2',
                email: 'struggling@test.com',
                profile: { fullName: 'Needs Help' },
                sessions: [
                  {
                    tenantId,
                    overallScore: 5.0,
                    completedAt: new Date(),
                    turns: [
                      {
                        status: 'EVALUATED',
                        question: { keyFocus: 'Garbage collection' },
                        answer: {
                          evaluation: {
                            score: 5.0,
                            authorityState: 'AUTHORITATIVE',
                            needsReview: false,
                            provider: 'openai',
                            evidence: ['verified rubric evidence'],
                          },
                        },
                      },
                    ],
                  },
                ],
                readinessSnapshots: [{ readinessScore: 52 }],
              },
            },
          },
        ],
        assignments: [{ id: 'a-1' }],
      });

      const analytics = await cohortAnalyticsService.getCohortAnalytics(cohortId, {
        userId: 'instructor-1',
        systemRole: UserRole.CANDIDATE,
        tenantRole: TenantRole.INSTRUCTOR,
        tenantId,
      });
      expect(analytics.cohortId).toBe(cohortId);
      expect(analytics.totalStudents).toBe(2);
      expect(analytics.activeStudents).toBe(2);
      expect(analytics.overallAverageScore).toBe(7.1); // (9.2 + 5.0) / 2
      expect(analytics.completionRate).toBe(100);
      expect(analytics.skillHeatmap.length).toBe(5);
      expect(analytics.topPerformers.length).toBe(1);
      expect(analytics.topPerformers[0].fullName).toBe('Top Student');
      expect(analytics.studentsNeedingHelp.length).toBe(1);
      expect(analytics.studentsNeedingHelp[0].fullName).toBe('Needs Help');
      // The service derives readiness from this tenant's authoritative
      // evaluations; a user-global snapshot must not be returned.
      expect(analytics.topPerformers[0].readinessScore).toBe(92);
    });

    it('excludes non-authoritative evaluations and stale global scores from tenant analytics', async () => {
      const tenantId = 'tenant-1';
      const cohortId = 'cohort-1';
      mockPrisma.cohort.findFirst.mockResolvedValue({
        id: cohortId,
        tenantId,
        name: 'Tenant A',
        assignments: [],
        members: [
          {
            tenantMember: {
              user: {
                id: 'candidate-1',
                email: 'candidate@example.com',
                profile: { fullName: 'Candidate' },
                // This is intentionally an inflated user-global snapshot.
                readinessSnapshots: [{ readinessScore: 99 }],
                sessions: [
                  {
                    tenantId,
                    overallScore: 10,
                    completedAt: new Date(),
                    turns: [
                      {
                        status: 'EVALUATED',
                        question: { keyFocus: 'Untrusted result' },
                        answer: {
                          evaluation: {
                            score: 10,
                            authorityState: 'NEEDS_REVIEW',
                            needsReview: true,
                            provider: 'mock',
                            evidence: ['synthetic result'],
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      });

      const analytics = await cohortAnalyticsService.getCohortAnalytics(cohortId, {
        userId: 'instructor-1',
        systemRole: UserRole.CANDIDATE,
        tenantRole: TenantRole.INSTRUCTOR,
        tenantId,
      });

      expect(analytics.overallAverageScore).toBe(0);
      expect(analytics.activeStudents).toBe(0);
      expect(analytics.studentsNeedingHelp[0]?.averageScore).toBe(0);
      expect(analytics.studentsNeedingHelp[0]?.readinessScore).toBeUndefined();
    });
  });

  describe('5. Final-resource cohort authorization (F5)', () => {
    const studentAccess = {
      userId: 'student-1',
      systemRole: UserRole.CANDIDATE,
      tenantRole: TenantRole.STUDENT,
      tenantId: 'tenant-1',
    };

    it('scopes a student cohort lookup through exact tenant and cohort membership', async () => {
      mockPrisma.cohort.findFirst.mockResolvedValue(null);

      await expect(cohortService.getCohort('cohort-other', studentAccess)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.cohort.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'cohort-other',
            tenantId: 'tenant-1',
            members: {
              some: {
                tenantMember: {
                  is: { userId: 'student-1', tenantId: 'tenant-1' },
                },
              },
            },
          },
        }),
      );
    });

    it('minimizes roster and assignment data returned to a cohort member student', async () => {
      mockPrisma.cohort.findFirst.mockResolvedValue({
        id: 'cohort-1',
        tenantId: 'tenant-1',
        name: 'Student Cohort',
        description: null,
        isActive: true,
        members: [
          {
            id: 'cohort-member-1',
            tenantMemberId: 'tenant-member-1',
            enrolledAt: new Date(),
            tenantMember: {
              userId: 'student-1',
              role: TenantRole.STUDENT,
              user: { email: 'student@example.com', profile: { fullName: 'Student' } },
            },
          },
        ],
        assignments: [
          {
            id: 'assignment-1',
            cohortId: 'cohort-1',
            title: 'Published work',
            description: null,
            status: AssignmentStatus.PUBLISHED,
            deadline: null,
            config: { rubricId: 'internal-rubric' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await cohortService.getCohort('cohort-1', studentAccess);
      expect(result.members).toEqual([
        expect.objectContaining({ role: TenantRole.STUDENT, enrolledAt: expect.any(Date) }),
      ]);
      expect(result.members[0]).not.toHaveProperty('email');
      expect(result.members[0]).not.toHaveProperty('userId');
      expect(result.members[0]).not.toHaveProperty('tenantMemberId');
      expect(result.assignments[0]).not.toHaveProperty('config');
    });

    it('shows students only published assignment metadata without cohort aggregates', async () => {
      mockPrisma.cohort.findFirst.mockResolvedValue({ id: 'cohort-1' });
      mockPrisma.assignment.findMany.mockResolvedValue([
        {
          id: 'assignment-1',
          cohortId: 'cohort-1',
          title: 'Published work',
          description: null,
          status: AssignmentStatus.PUBLISHED,
          deadline: null,
          config: {
            sessionMode: 'STANDARD',
            difficulty: 2,
            targetScore: 7,
            rubricId: 'internal-rubric',
            questionBankId: 'internal-bank',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await assignmentService.listCohortAssignments('cohort-1', studentAccess);
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cohortId: 'cohort-1', status: AssignmentStatus.PUBLISHED },
        }),
      );
      expect(result[0]).not.toHaveProperty('averageScore');
      expect(result[0]).not.toHaveProperty('totalCandidates');
      expect(result[0].config).not.toHaveProperty('rubricId');
      expect(result[0].config).not.toHaveProperty('questionBankId');
    });
  });
});
