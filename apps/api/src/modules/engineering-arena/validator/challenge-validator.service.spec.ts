import { ChallengeValidatorService, ValidatorStageStatus } from './challenge-validator.service';
import { ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

describe('ChallengeValidatorService', () => {
  let service: ChallengeValidatorService;

  const validManifest = {
    schemaVersion: '1.0' as const,
    slug: 'fix-race-condition-in-counter',
    title: 'Fix Race Condition in Counter',
    description: 'Resolve race condition under concurrent increments.',
    domain: ChallengeDomain.BACKEND,
    category: ChallengeCategory.BUG_FIX,
    difficulty: 3,
    estimatedMinutes: 30,
    environment: {
      runtime: 'node:22',
      memoryLimitMb: 512,
      cpuLimit: 1.0,
    },
    visibleFiles: ['src/counter.ts', 'test/counter.test.ts'],
    editableFiles: ['src/counter.ts'],
    hiddenFiles: ['test/hidden-concurrency.test.ts'],
    commands: [
      {
        id: 'test',
        label: 'Run Tests',
        command: 'npm test',
        args: [],
        timeoutSeconds: 15,
        isVerification: false,
      },
    ],
    rubric: {
      version: '1.0',
      objectiveWeight: 0.7,
      rubricWeight: 0.3,
      criteria: [
        {
          key: 'atomic_concurrency',
          name: 'Atomic Concurrency',
          description: 'Mutex or atomic ops used.',
          maxPoints: 50,
        },
      ],
    },
    skills: [{ taxonomyKey: 'concurrency_synchronization', weight: 1.0 }],
  };

  beforeEach(() => {
    service = new ChallengeValidatorService();
  });

  it('passes all stages for a valid, clean package', async () => {
    const report = await service.validateChallengePackage({
      manifest: validManifest,
      visibleFilesContent: {
        'src/counter.ts': 'export class Counter {}',
        'test/counter.test.ts': 'test("increments", () => {});',
      },
      hiddenFilesContent: {
        'test/hidden-concurrency.test.ts': 'test("high concurrency", () => {});',
      },
    });

    expect(report.overallPass).toBe(true);
    expect(report.failedStages).toBe(0);
    expect(report.passedStages).toBe(6);
  });

  it('fails Stage 2 (SOURCE_INTEGRITY) when visible files are missing', async () => {
    const report = await service.validateChallengePackage({
      manifest: validManifest,
      visibleFilesContent: {
        'src/counter.ts': 'export class Counter {}',
        // 'test/counter.test.ts' is missing!
      },
      hiddenFilesContent: {},
    });

    expect(report.overallPass).toBe(false);
    const stage2 = report.stages.find(s => s.stage === '2_SOURCE_INTEGRITY');
    expect(stage2?.status).toBe(ValidatorStageStatus.FAIL);
    expect(stage2?.message).toContain('test/counter.test.ts');
  });

  it('fails Stage 3 (SECRETS_SCAN) when AWS credentials or private keys are detected', async () => {
    const report = await service.validateChallengePackage({
      manifest: validManifest,
      visibleFilesContent: {
        'src/counter.ts': 'const key = "' + 'AKIA' + '1111111111111111";',
        'test/counter.test.ts': 'test("ok", () => {});',
      },
      hiddenFilesContent: {},
    });

    expect(report.overallPass).toBe(false);
    const stage3 = report.stages.find(s => s.stage === '3_SECRETS_SCAN');
    expect(stage3?.status).toBe(ValidatorStageStatus.FAIL);
    expect(stage3?.message).toContain('Potential credential found');
  });

  it('fails Stage 5 (CANDIDATE_ARTIFACT_SEPARATION) when hidden files leak into visible content', async () => {
    const report = await service.validateChallengePackage({
      manifest: validManifest,
      visibleFilesContent: {
        'src/counter.ts': 'export class Counter {}',
        'test/counter.test.ts': 'test("ok", () => {});',
        'test/hidden-concurrency.test.ts': 'leaked!', // Leak!
      },
      hiddenFilesContent: {
        'test/hidden-concurrency.test.ts': 'test("high concurrency", () => {});',
      },
    });

    expect(report.overallPass).toBe(false);
    const stage5 = report.stages.find(s => s.stage === '5_CANDIDATE_ARTIFACT_SEPARATION');
    expect(stage5?.status).toBe(ValidatorStageStatus.FAIL);
  });
});
