import { describe, it, expect } from 'vitest';
import {
  ArenaChallengeManifestSchema,
  StartArenaSessionRequestSchema,
  ArenaRunCommandRequestSchema,
  ArenaSubmitSolutionRequestSchema,
  ArenaEvaluationResponseSchema,
  ChallengeDomain,
  ChallengeCategory,
  ArenaAiAssistanceMode,
} from '../index';

describe('Engineering Arena Contracts', () => {
  it('validates a correct ArenaChallengeManifest', () => {
    const validManifest = {
      schemaVersion: '1.0',
      slug: 'fix-memory-leak-event-emitter',
      title: 'Fix Memory Leak in EventEmitter Cache',
      description: 'Find and fix memory leak in cached event emitter listener registration.',
      domain: ChallengeDomain.BACKEND,
      category: ChallengeCategory.BUG_FIX,
      difficulty: 3,
      estimatedMinutes: 30,
      environment: {
        runtime: 'node:22',
        entrypoint: 'npm test',
        memoryLimitMb: 512,
        cpuLimit: 1.0,
      },
      visibleFiles: ['src/cache.ts', 'test/cache.test.ts'],
      editableFiles: ['src/cache.ts'],
      hiddenFiles: ['test/hidden.test.ts'],
      commands: [
        {
          id: 'test',
          label: 'Run Unit Tests',
          command: 'npm test',
          args: ['--run'],
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
            key: 'root_cause_analysis',
            name: 'Root Cause Analysis',
            description: 'Identified that listener was not removed on cache eviction.',
            maxPoints: 50,
          },
        ],
      },
      skills: [
        {
          taxonomyKey: 'nodejs_eventloop',
          weight: 1.0,
        },
      ],
    };

    const parsed = ArenaChallengeManifestSchema.safeParse(validManifest);
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid ArenaChallengeManifest with missing commands', () => {
    const invalidManifest = {
      schemaVersion: '1.0',
      slug: 'invalid-manifest',
      title: 'Invalid',
      description: 'No commands',
      domain: ChallengeDomain.BACKEND,
      category: ChallengeCategory.BUG_FIX,
      environment: {
        runtime: 'node:22',
      },
      commands: [], // Min 1 required
    };

    const parsed = ArenaChallengeManifestSchema.safeParse(invalidManifest);
    expect(parsed.success).toBe(false);
  });

  it('validates StartArenaSessionRequest', () => {
    const request = {
      challengeSlug: 'fix-memory-leak',
      aiAssistanceMode: ArenaAiAssistanceMode.HINTS_ONLY,
    };
    const parsed = StartArenaSessionRequestSchema.safeParse(request);
    expect(parsed.success).toBe(true);
  });

  it('validates ArenaRunCommandRequest', () => {
    const request = {
      commandId: 'test',
      modifiedFiles: [
        {
          path: 'src/cache.ts',
          content: 'export class Cache {}',
        },
      ],
    };
    const parsed = ArenaRunCommandRequestSchema.safeParse(request);
    expect(parsed.success).toBe(true);
  });

  it('validates ArenaSubmitSolutionRequest', () => {
    const request = {
      explanation: 'Removed listener on cleanup.',
      finalFiles: [
        {
          path: 'src/cache.ts',
          content: 'export class Cache {}',
        },
      ],
    };
    const parsed = ArenaSubmitSolutionRequestSchema.safeParse(request);
    expect(parsed.success).toBe(true);
  });

  it('validates ArenaEvaluationResponse', () => {
    const response = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sessionId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      submissionId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      scoreBreakdown: {
        objectiveScore: 80,
        rubricScore: 90,
        finalScore: 83,
        scoreCapApplied: false,
        testsVisiblePassed: 4,
        testsVisibleTotal: 4,
        testsHiddenPassed: 3,
        testsHiddenTotal: 4,
      },
      aiFeedbackSummary: 'Good fix with clear memory release.',
      rubricCriteriaFeedback: [
        {
          key: 'root_cause_analysis',
          name: 'Root Cause Analysis',
          score: 45,
          maxPoints: 50,
          feedback: 'Accurate deduction.',
        },
      ],
      skillEvidences: [
        {
          taxonomyKey: 'nodejs_eventloop',
          evidenceType: 'TEST_VERIFICATION',
          scoreContribution: 83,
          confidence: 0.95,
          sourceSummary: 'Passed all visible and 3/4 hidden test cases.',
        },
      ],
      evaluatedAt: '2026-08-28T12:00:00.000Z',
    };
    const parsed = ArenaEvaluationResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });
});
