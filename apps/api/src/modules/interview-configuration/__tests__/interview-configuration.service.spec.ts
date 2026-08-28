import { Test, TestingModule } from '@nestjs/testing';
import { InterviewConfigurationService } from '../interview-configuration.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { BillingService } from '../../billing/billing.service';
import { SessionMode, CompetencyArea, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

describe('InterviewConfigurationService', () => {
  let service: InterviewConfigurationService;
  let prisma: any;
  let billingService: any;

  const mockUser = { id: 'user-111-uuid', email: 'candidate@example.com' };
  const mockOtherUser = { id: 'user-222-uuid', email: 'other@example.com' };

  const mockJobRole = {
    id: 'role-be-uuid',
    slug: 'backend-engineer',
    name: 'Backend Engineer',
    description: 'Backend role',
    isActive: true,
  };

  const mockSeniorityLevel = {
    id: 'level-sr-uuid',
    slug: 'senior',
    name: 'Senior',
    order: 4,
    description: 'Senior level',
    isActive: true,
  };

  const mockTechnologies = [
    { id: 'tech-node-uuid', slug: 'nodejs', name: 'Node.js', category: 'Backend', isActive: true },
    {
      id: 'tech-pg-uuid',
      slug: 'postgresql',
      name: 'PostgreSQL',
      category: 'Database',
      isActive: true,
    },
    { id: 'tech-docker-uuid', slug: 'docker', name: 'Docker', category: 'DevOps', isActive: true },
  ];

  beforeEach(async () => {
    prisma = {
      jobRole: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockJobRole.id) return Promise.resolve(mockJobRole);
          if (where.id === 'inactive-role-id')
            return Promise.resolve({ ...mockJobRole, id: 'inactive-role-id', isActive: false });
          return Promise.resolve(null);
        }),
      },
      seniorityLevel: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockSeniorityLevel.id) return Promise.resolve(mockSeniorityLevel);
          if (where.id === 'inactive-level-id')
            return Promise.resolve({
              ...mockSeniorityLevel,
              id: 'inactive-level-id',
              isActive: false,
            });
          return Promise.resolve(null);
        }),
      },
      technology: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const ids: string[] = where?.id?.in || [];
          return Promise.resolve(
            ids
              .map(id => {
                if (id === 'inactive-tech-id')
                  return {
                    id,
                    slug: 'inactive',
                    name: 'Inactive Tech',
                    category: 'Old',
                    isActive: false,
                  };
                return mockTechnologies.find(t => t.id === id) || null;
              })
              .filter(Boolean),
          );
        }),
      },
      interviewConfigurationPreset: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'preset-created-uuid',
            createdAt: new Date(),
            updatedAt: new Date(),
            useCount: 0,
            lastUsedAt: null,
            jobRole: mockJobRole,
            seniorityLevel: mockSeniorityLevel,
            ...data,
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'preset-1-uuid',
            userId: mockUser.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            useCount: 1,
            lastUsedAt: new Date(),
            jobRole: mockJobRole,
            seniorityLevel: mockSeniorityLevel,
            ...data,
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue({ id: 'preset-1-uuid' }),
      },
      recentInterviewConfiguration: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({ id: 'recent-1-uuid' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    billingService = {
      getSubscription: jest.fn().mockResolvedValue({
        plan: {
          slug: 'free',
          limits: {
            allowLiveCoding: true,
            allowSystemDesign: true,
          },
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewConfigurationService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
      ],
    }).compile();

    service = module.get<InterviewConfigurationService>(InterviewConfigurationService);
  });

  describe('Fingerprint Generation (Deterministic Hash)', () => {
    it('generates identical fingerprint regardless of technologyIds ordering', () => {
      const configA = {
        jobRoleId: mockJobRole.id,
        seniorityLevelId: mockSeniorityLevel.id,
        technologyIds: ['tech-pg-uuid', 'tech-node-uuid', 'tech-docker-uuid'],
        sessionMode: SessionMode.STANDARD,
        language: 'vi',
        totalTurns: 5,
        isSandbox: false,
      };

      const configB = {
        jobRoleId: mockJobRole.id,
        seniorityLevelId: mockSeniorityLevel.id,
        technologyIds: ['tech-docker-uuid', 'tech-node-uuid', 'tech-pg-uuid'],
        sessionMode: SessionMode.STANDARD,
        language: 'vi',
        totalTurns: 5,
        isSandbox: false,
      };

      const hashA = service.computeFingerprint(configA);
      const hashB = service.computeFingerprint(configB);

      expect(hashA).toBe(hashB);
      expect(hashA).toHaveLength(64);
    });

    it('generates different fingerprints when configuration parameters differ', () => {
      const base = {
        jobRoleId: mockJobRole.id,
        seniorityLevelId: mockSeniorityLevel.id,
        technologyIds: ['tech-node-uuid'],
        sessionMode: SessionMode.STANDARD,
      };

      const hashBase = service.computeFingerprint(base);
      const hashDiffMode = service.computeFingerprint({ ...base, sessionMode: SessionMode.CODING });
      const hashDiffTurns = service.computeFingerprint({ ...base, totalTurns: 3 });
      const hashDiffSandbox = service.computeFingerprint({ ...base, isSandbox: true });

      expect(hashBase).not.toBe(hashDiffMode);
      expect(hashBase).not.toBe(hashDiffTurns);
      expect(hashBase).not.toBe(hashDiffSandbox);
    });
  });

  describe('Configuration Validation', () => {
    it('returns isValid: true when all taxonomy items are active and valid', async () => {
      const validConfig = {
        jobRoleId: mockJobRole.id,
        seniorityLevelId: mockSeniorityLevel.id,
        technologyIds: ['tech-node-uuid', 'tech-pg-uuid'],
        sessionMode: SessionMode.STANDARD,
        totalTurns: 5,
      };

      const result = await service.validateConfiguration(mockUser.id, validConfig);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.resolvedTaxonomy?.jobRole?.slug).toBe('backend-engineer');
    });

    it('flags issues when role or level is inactive or missing', async () => {
      const invalidConfig = {
        jobRoleId: 'inactive-role-id',
        seniorityLevelId: 'non-existent-level-id',
        technologyIds: ['tech-node-uuid'],
      };

      const result = await service.validateConfiguration(mockUser.id, invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.code === 'ROLE_INACTIVE')).toBe(true);
      expect(result.issues.some(i => i.code === 'LEVEL_NOT_FOUND')).toBe(true);
    });

    it('flags issues when technologies are inactive or count is out of bounds', async () => {
      const invalidConfig = {
        jobRoleId: mockJobRole.id,
        seniorityLevelId: mockSeniorityLevel.id,
        technologyIds: ['tech-node-uuid', 'inactive-tech-id'],
      };

      const result = await service.validateConfiguration(mockUser.id, invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.code === 'TECHNOLOGY_INACTIVE')).toBe(true);
    });
  });

  describe('Preset Limits & Subscription Entitlements', () => {
    it('enforces free plan max preset limit of 3', async () => {
      prisma.interviewConfigurationPreset.count.mockResolvedValue(3);

      const dto = {
        name: 'Preset 4',
        config: {
          jobRoleId: mockJobRole.id,
          seniorityLevelId: mockSeniorityLevel.id,
          technologyIds: ['tech-node-uuid'],
        },
      };

      await expect(service.createPreset(mockUser.id, dto)).rejects.toThrow(DomainException);
    });

    it('allows pro users up to 20 presets', async () => {
      billingService.getSubscription.mockResolvedValue({
        plan: { slug: 'pro' },
      });
      prisma.interviewConfigurationPreset.count.mockResolvedValue(15);

      const dto = {
        name: 'Pro Preset 16',
        config: {
          jobRoleId: mockJobRole.id,
          seniorityLevelId: mockSeniorityLevel.id,
          technologyIds: ['tech-node-uuid'],
        },
      };

      const result = await service.createPreset(mockUser.id, dto);
      expect(result.name).toBe('Pro Preset 16');
    });
  });

  describe('Preset Ownership & IDOR Security', () => {
    it('prevents creating preset with duplicate name for the same user', async () => {
      prisma.interviewConfigurationPreset.findUnique.mockResolvedValue({
        id: 'existing-preset-id',
        userId: mockUser.id,
        name: 'My Preset',
      });

      const dto = {
        name: 'My Preset',
        config: {
          jobRoleId: mockJobRole.id,
          seniorityLevelId: mockSeniorityLevel.id,
          technologyIds: ['tech-node-uuid'],
        },
      };

      await expect(service.createPreset(mockUser.id, dto)).rejects.toThrow(DomainException);
    });

    it('rejects update if preset belongs to a different user (IDOR prevention)', async () => {
      prisma.interviewConfigurationPreset.findUnique.mockResolvedValue({
        id: 'preset-other-user',
        userId: mockOtherUser.id,
        name: 'Other Preset',
      });

      await expect(
        service.updatePreset(mockUser.id, 'preset-other-user', { name: 'Hacked Preset' }),
      ).rejects.toThrow(DomainException);
    });

    it('rejects delete if preset belongs to a different user', async () => {
      prisma.interviewConfigurationPreset.findUnique.mockResolvedValue({
        id: 'preset-other-user',
        userId: mockOtherUser.id,
        name: 'Other Preset',
      });

      await expect(service.deletePreset(mockUser.id, 'preset-other-user')).rejects.toThrow(
        DomainException,
      );
    });
  });

  describe('Recent Configurations & Upserting', () => {
    it('upserts recent configuration with fingerprint to prevent duplicate records', async () => {
      const config = {
        jobRoleId: mockJobRole.id,
        seniorityLevelId: mockSeniorityLevel.id,
        technologyIds: ['tech-node-uuid', 'tech-pg-uuid'],
        sessionMode: SessionMode.STANDARD,
      };

      await service.recordRecentConfiguration(mockUser.id, config, 'preset-1-uuid');

      expect(prisma.recentInterviewConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_fingerprint: {
              userId: mockUser.id,
              fingerprint: expect.any(String),
            },
          },
          update: {
            useCount: { increment: 1 },
            lastUsedAt: expect.any(Date),
          },
        }),
      );

      expect(prisma.interviewConfigurationPreset.updateMany).toHaveBeenCalledWith({
        where: { id: 'preset-1-uuid', userId: mockUser.id },
        data: {
          useCount: { increment: 1 },
          lastUsedAt: expect.any(Date),
        },
      });
    });
  });

  describe('Immutable Configuration Snapshot Persistence', () => {
    it('builds comprehensive resolved snapshot with timestamp and fingerprint', async () => {
      const config = {
        jobRoleId: mockJobRole.id,
        seniorityLevelId: mockSeniorityLevel.id,
        technologyIds: ['tech-node-uuid', 'tech-pg-uuid'],
        sessionMode: SessionMode.STANDARD,
        competencyArea: CompetencyArea.SYSTEM_DESIGN,
        language: 'vi',
        totalTurns: 5,
        isSandbox: false,
      };

      const snapshot = await service.buildConfigurationSnapshot(config);

      expect(snapshot.fingerprint).toBeDefined();
      expect(snapshot.jobRole.slug).toBe('backend-engineer');
      expect(snapshot.seniorityLevel.slug).toBe('senior');
      expect(snapshot.technologies).toHaveLength(2);
      expect(snapshot.snapshotTimestamp).toBeDefined();
    });
  });
});
