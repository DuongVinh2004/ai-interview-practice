import { Test, TestingModule } from '@nestjs/testing';
import { ArenaAdminService } from './arena-admin.service';
import { ArenaChallengeRepository } from '../repositories/arena-challenge.repository';
import { ChallengeValidatorService } from '../validator/challenge-validator.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

describe('ArenaAdminService', () => {
  let service: ArenaAdminService;
  let prisma: {
    $transaction: jest.Mock;
    engineeringChallengeVersion: { update: jest.Mock };
  };
  let challengeRepo: {
    findBySlug: jest.Mock;
    findVersionById: jest.Mock;
  };
  let validatorService: {
    validateChallengePackage: jest.Mock;
  };

  const sampleManifest = {
    schemaVersion: '1.0' as const,
    slug: 'fix-memory-leak',
    title: 'Fix Memory Leak',
    description: 'Fix leak in event listeners',
    domain: ChallengeDomain.BACKEND,
    category: ChallengeCategory.BUG_FIX,
    difficulty: 3,
    estimatedMinutes: 30,
    environment: {
      runtime: 'node:22',
      memoryLimitMb: 512,
      cpuLimit: 1.0,
    },
    visibleFiles: ['src/cache.ts'],
    editableFiles: ['src/cache.ts'],
    hiddenFiles: ['test/hidden.test.ts'],
    commands: [
      {
        id: 'test',
        label: 'Run',
        command: 'npm test',
        args: [],
        timeoutSeconds: 15,
        isVerification: false,
      },
    ],
    rubric: { version: '1.0', objectiveWeight: 0.7, rubricWeight: 0.3, criteria: [] },
    skills: [],
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async cb => {
        const tx = {
          engineeringChallenge: {
            create: jest.fn().mockResolvedValue({ id: 'c1', slug: 'fix-memory-leak' }),
            update: jest.fn().mockResolvedValue({ id: 'c1' }),
          },
          engineeringChallengeVersion: {
            create: jest.fn().mockResolvedValue({ id: 'v1', challengeId: 'c1' }),
            update: jest.fn().mockResolvedValue({ id: 'v1', activatedAt: new Date() }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return cb(tx);
      }),
      engineeringChallengeVersion: {
        update: jest.fn().mockResolvedValue({ id: 'v1', deprecatedAt: new Date() }),
      },
    };

    challengeRepo = {
      findBySlug: jest.fn(),
      findVersionById: jest.fn(),
    };

    validatorService = {
      validateChallengePackage: jest.fn().mockResolvedValue({
        overallPass: true,
        passedStages: 6,
        failedStages: 0,
        stages: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArenaAdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: ArenaChallengeRepository, useValue: challengeRepo },
        { provide: ChallengeValidatorService, useValue: validatorService },
      ],
    }).compile();

    service = module.get<ArenaAdminService>(ArenaAdminService);
  });

  describe('createChallengeDraft', () => {
    it('creates draft when slug does not exist and validator passes', async () => {
      challengeRepo.findBySlug.mockResolvedValue(null);

      const result = await service.createChallengeDraft({
        manifest: sampleManifest,
        adminId: 'admin-1',
        visibleFilesContent: { 'src/cache.ts': 'export class Cache {}' },
        hiddenFilesContent: { 'test/hidden.test.ts': 'test()' },
      });

      expect(result.challenge.id).toBe('c1');
      expect(result.version.id).toBe('v1');
      expect(validatorService.validateChallengePackage).toHaveBeenCalled();
    });

    it('throws CONFLICT if slug already exists', async () => {
      challengeRepo.findBySlug.mockResolvedValue({ id: 'c-exists' });

      await expect(
        service.createChallengeDraft({
          manifest: sampleManifest,
          adminId: 'admin-1',
          visibleFilesContent: {},
          hiddenFilesContent: {},
        }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('activateVersion', () => {
    it('activates validated version successfully', async () => {
      challengeRepo.findVersionById.mockResolvedValue({
        id: 'v1',
        challengeId: 'c1',
        validatorStatus: 'VALID',
      });

      const result = await service.activateVersion('v1');
      expect(result.id).toBe('v1');
    });

    it('rejects activation if validator status is not VALID', async () => {
      challengeRepo.findVersionById.mockResolvedValue({
        id: 'v1',
        challengeId: 'c1',
        validatorStatus: 'INVALID',
      });

      await expect(service.activateVersion('v1')).rejects.toThrow(DomainException);
    });
  });
});
