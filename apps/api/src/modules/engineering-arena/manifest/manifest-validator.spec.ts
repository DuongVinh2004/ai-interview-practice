import { ManifestValidator } from './manifest-validator';
import { ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

describe('ManifestValidator', () => {
  const getValidManifest = () => ({
    schemaVersion: '1.0',
    slug: 'refactor-sql-query-builder',
    title: 'Refactor SQL Query Builder',
    description: 'Refactor query builder into clean pipeline.',
    domain: ChallengeDomain.BACKEND,
    category: ChallengeCategory.REFACTORING,
    difficulty: 3,
    estimatedMinutes: 45,
    environment: {
      runtime: 'node:22',
      entrypoint: 'npm test',
      memoryLimitMb: 512,
      cpuLimit: 1.0,
    },
    visibleFiles: ['src/builder.ts', 'test/builder.test.ts'],
    editableFiles: ['src/builder.ts'],
    hiddenFiles: ['test/hidden-builder.test.ts'],
    commands: [
      {
        id: 'test',
        label: 'Run Unit Tests',
        command: 'npm test',
        args: [],
        timeoutSeconds: 15,
        isVerification: false,
      },
      {
        id: 'verify',
        label: 'Full Verification',
        command: 'npm run verify',
        args: [],
        timeoutSeconds: 30,
        isVerification: true,
      },
    ],
    rubric: {
      version: '1.0',
      objectiveWeight: 0.7,
      rubricWeight: 0.3,
      criteria: [
        {
          key: 'code_modularity',
          name: 'Code Modularity',
          description: 'Clean separation of concerns.',
          maxPoints: 50,
        },
      ],
    },
    skills: [{ taxonomyKey: 'typescript_design_patterns', weight: 1.0 }],
  });

  it('validates a correct manifest with no errors', () => {
    const manifest = getValidManifest();
    const result = ManifestValidator.validate(manifest);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects duplicate command IDs', () => {
    const manifest = getValidManifest();
    manifest.commands.push({
      id: 'test', // Duplicate!
      label: 'Duplicate Test',
      command: 'npm test',
      args: [],
      timeoutSeconds: 10,
      isVerification: false,
    });

    const result = ManifestValidator.validate(manifest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate command ID 'test'"))).toBe(true);
  });

  it('rejects weights not summing to 1.0', () => {
    const manifest = getValidManifest();
    manifest.rubric.objectiveWeight = 0.5;
    manifest.rubric.rubricWeight = 0.2; // sum = 0.7 != 1.0

    const result = ManifestValidator.validate(manifest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('must sum to 1.0'))).toBe(true);
  });

  it('rejects hidden files that are in visible or editable sets', () => {
    const manifest = getValidManifest();
    manifest.visibleFiles.push('test/hidden-builder.test.ts'); // Leaked into visible!

    const result = ManifestValidator.validate(manifest);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Security violation'))).toBe(true);
  });

  it('rejects excessive memory limits', () => {
    const manifest = getValidManifest();
    manifest.environment.memoryLimitMb = 4096; // Exceeds 2048

    const result = ManifestValidator.validate(manifest);
    expect(result.isValid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes('environment.memoryLimitMb') || e.includes('Memory limit'),
      ),
    ).toBe(true);
  });
});
