import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { B2bChallengeService } from '../services/b2b-challenge.service';
import { ChallengeValidatorService } from '../../engineering-arena/validator/challenge-validator.service';
import { ArenaChallengeRepository } from '../../engineering-arena/repositories/arena-challenge.repository';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ArenaChallengeStatus } from '@prisma/client';

describe('B2B Enterprise Custom Challenge Authoring (Roadmap 2.2)', () => {
  let service: B2bChallengeService;
  let prisma: any;
  let validatorService: any;
  let challengeRepo: any;

  const validManifest: any = {
    slug: 'acme-sql-injection-fix',
    title: 'Fix SQL Injection in ACME Billing API',
    schemaVersion: '1.0',
    domain: 'BACKEND',
    category: 'SECURITY',
    difficulty: 3,
    estimatedMinutes: 30,
    tags: ['security', 'sql'],
    instructionsMarkdown: 'Sanitize query inputs to eliminate SQL injection vulnerabilities.',
    workspaceTemplate: {
      allowedCommandIds: ['test'],
      readOnlyFiles: ['package.json'],
      hiddenFiles: ['test/hidden-exploit.spec.ts'],
    },
    commands: [
      {
        id: 'test',
        label: 'Run Tests',
        command: 'pnpm test',
        timeoutMs: 15000,
      },
    ],
    rubric: {
      version: '1.0',
      totalPoints: 100,
      criteria: [
        {
          id: 'crit-1',
          name: 'SQL Injection Defense',
          maxPoints: 100,
          required: true,
          verificationType: 'TEST_CASE',
          targetRef: 'test/hidden-exploit.spec.ts',
        },
      ],
    },
  };

  beforeEach(async () => {
    prisma = {
      engineeringChallenge: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      engineeringChallengeVersion: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(cb => cb(prisma)),
    };

    validatorService = {
      validateChallengePackage: jest.fn().mockResolvedValue({
        overallPass: true,
        totalStages: 6,
        passedStages: 6,
        failedStages: 0,
        stages: [],
        validatedAt: new Date().toISOString(),
      }),
    };

    challengeRepo = {
      findBySlug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        B2bChallengeService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChallengeValidatorService, useValue: validatorService },
        { provide: ArenaChallengeRepository, useValue: challengeRepo },
      ],
    }).compile();

    service = module.get<B2bChallengeService>(B2bChallengeService);
  });

  describe('1. validateChallenge', () => {
    it('should delegate validation to ChallengeValidatorService and return report', async () => {
      const report = await service.validateChallenge({
        manifest: validManifest,
        visibleFilesContent: { 'src/query.ts': 'export const q = "SELECT 1";' },
        hiddenFilesContent: { 'test/hidden-exploit.spec.ts': 'test("exploit", () => {});' },
      });

      expect(report.overallPass).toBe(true);
      expect(validatorService.validateChallengePackage).toHaveBeenCalled();
    });
  });

  describe('2. createCustomChallenge', () => {
    it('should reject challenge creation when 6-stage validation fails', async () => {
      validatorService.validateChallengePackage.mockResolvedValueOnce({
        overallPass: false,
        totalStages: 6,
        passedStages: 4,
        failedStages: 2,
        stages: [{ stage: '1_MANIFEST_SCHEMA', status: 'FAIL', message: 'Invalid slug' }],
        validatedAt: new Date().toISOString(),
      });

      await expect(
        service.createCustomChallenge({
          tenantId: 'tenant-acme',
          userId: 'user-admin-acme',
          manifest: validManifest,
          visibleFilesContent: {},
          hiddenFilesContent: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject creation if challenge slug already exists in registry', async () => {
      challengeRepo.findBySlug.mockResolvedValueOnce({ id: 'c-1', slug: 'acme-sql-injection-fix' });

      await expect(
        service.createCustomChallenge({
          tenantId: 'tenant-acme',
          userId: 'user-admin-acme',
          manifest: validManifest,
          visibleFilesContent: {},
          hiddenFilesContent: {},
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create challenge draft and initial version with tenant metadata', async () => {
      challengeRepo.findBySlug.mockResolvedValueOnce(null);
      prisma.engineeringChallenge.create.mockResolvedValueOnce({
        id: 'challenge-new-1',
        slug: validManifest.slug,
        title: validManifest.title,
        status: ArenaChallengeStatus.DRAFT,
        createdById: 'user-admin-acme',
      });
      prisma.engineeringChallengeVersion.create.mockResolvedValueOnce({
        id: 'version-new-1',
        challengeId: 'challenge-new-1',
        versionNumber: 1,
        validatorStatus: 'VALID',
      });

      const result = await service.createCustomChallenge({
        tenantId: 'tenant-acme',
        userId: 'user-admin-acme',
        manifest: validManifest,
        visibleFilesContent: { 'src/query.ts': 'clean query' },
        hiddenFilesContent: { 'test/hidden.ts': 'test' },
      });

      expect(result.challenge.id).toBe('challenge-new-1');
      expect(prisma.engineeringChallenge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: validManifest.slug,
            status: ArenaChallengeStatus.DRAFT,
            createdById: 'user-admin-acme',
          }),
        }),
      );
      expect(prisma.engineeringChallengeVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versionNumber: 1,
            validatorStatus: 'VALID',
          }),
        }),
      );
    });
  });

  describe('3. listTenantChallenges (Multi-Tenant Isolation)', () => {
    it('should list only challenges authored by the tenant admin user', async () => {
      prisma.engineeringChallenge.findMany.mockResolvedValueOnce([
        {
          id: 'c-1',
          slug: 'acme-sql-1',
          title: 'ACME SQL',
          status: 'DRAFT',
          createdById: 'user-acme',
        },
      ]);

      const list = await service.listTenantChallenges('tenant-acme', 'user-acme');
      expect(list).toHaveLength(1);
      expect(prisma.engineeringChallenge.findMany).toHaveBeenCalledWith({
        where: { createdById: 'user-acme' },
        include: { versions: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('4. publishTenantChallenge', () => {
    it('should throw NotFoundException if challenge does not exist', async () => {
      prisma.engineeringChallenge.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.publishTenantChallenge('non-existent-id', 'tenant-acme', 'user-acme'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is from different tenant / not author', async () => {
      prisma.engineeringChallenge.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        createdById: 'user-other-company',
      });

      await expect(
        service.publishTenantChallenge('c-1', 'tenant-acme', 'user-acme'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should publish challenge and activate latest version when authorized', async () => {
      prisma.engineeringChallenge.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        createdById: 'user-acme',
        status: ArenaChallengeStatus.DRAFT,
      });
      prisma.engineeringChallengeVersion.findFirst.mockResolvedValueOnce({
        id: 'v-1',
        challengeId: 'c-1',
        validatorStatus: 'VALID',
      });
      prisma.engineeringChallenge.update.mockResolvedValueOnce({
        id: 'c-1',
        status: ArenaChallengeStatus.PUBLISHED,
      });

      const published = await service.publishTenantChallenge('c-1', 'tenant-acme', 'user-acme');
      expect(published.status).toBe(ArenaChallengeStatus.PUBLISHED);
      expect(prisma.engineeringChallenge.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { status: ArenaChallengeStatus.PUBLISHED },
      });
    });
  });
});
