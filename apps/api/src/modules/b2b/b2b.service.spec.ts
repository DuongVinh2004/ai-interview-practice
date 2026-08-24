import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './services/tenant.service';
import { CohortService } from './services/cohort.service';
import { AssignmentService } from './services/assignment.service';
import { CohortAnalyticsService } from './services/cohort-analytics.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { TenantRole, AssignmentStatus, CompetencyArea } from '@ai-interview/contracts';
import { ConflictException, NotFoundException } from '@nestjs/common';

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

      const result = await cohortService.importRosterCsv(cohortId, tenantId, csvData);
      expect(result.totalImported).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.skippedCount).toBe(1); // 1 invalid email
      expect(result.errors.length).toBe(1);
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

      const published = await assignmentService.publishAssignment('assign-1', tenantId, AssignmentStatus.PUBLISHED);
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
                sessions: [{ overallScore: 9.2, completedAt: new Date() }],
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
                sessions: [{ overallScore: 5.0, completedAt: new Date() }],
                readinessSnapshots: [{ readinessScore: 52 }],
              },
            },
          },
        ],
        assignments: [{ id: 'a-1' }],
      });

      const analytics = await cohortAnalyticsService.getCohortAnalytics(cohortId, tenantId);
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
    });
  });
});
