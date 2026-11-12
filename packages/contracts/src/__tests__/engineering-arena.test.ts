import { describe, it, expect } from 'vitest';
import {
  ArenaChallengeManifestSchema,
  StartArenaSessionRequestSchema,
  ArenaRunCommandRequestSchema,
  ArenaSubmitSolutionRequestSchema,
  ArenaEvaluationResponseSchema,
  CodeSimilarityMatchSchema,
  PlagiarismReportSchema,
  ChallengeDomain,
  ChallengeCategory,
  ArenaAiAssistanceMode,
  ArenaCollaborativeRole,
  ArenaCollaborativeParticipantSchema,
  ArenaRoomPresenceSchema,
  ArenaCursorCoordinatePayloadSchema,
  ArenaCodeChangePayloadSchema,
  ArenaSharedTestBroadcastSchema,
  ArenaJoinRoomRequestSchema,
  ArenaRunStatus,
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

  it('validates CodeSimilarityMatchSchema correctly', () => {
    const match = {
      targetFile: 'src/solution.ts',
      sourceFile: 'src/solution.ts',
      similarityScore: 0.92,
      matchedFingerprints: 46,
      totalFingerprints: 50,
      matchedLines: [
        [10, 25],
        [30, 42],
      ],
      evidence: 'High lexical overlap detected across 2 block windows.',
    };
    const parsed = CodeSimilarityMatchSchema.safeParse(match);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.similarityScore).toBe(0.92);
      expect(parsed.data.matchedFingerprints).toBe(46);
    }
  });

  it('validates PlagiarismReportSchema correctly', () => {
    const report = {
      sessionId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      isPlagiarized: true,
      highestSimilarityScore: 0.94,
      forensicRiskScore: 85,
      matches: [
        {
          targetSessionId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99',
          targetFile: 'src/solution.ts',
          sourceFile: 'src/solution.ts',
          similarityScore: 0.94,
          matchedFingerprints: 47,
          totalFingerprints: 50,
        },
      ],
      analyzedAt: '2026-08-28T12:00:00.000Z',
    };
    const parsed = PlagiarismReportSchema.safeParse(report);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isPlagiarized).toBe(true);
      expect(parsed.data.forensicRiskScore).toBe(85);
    }
  });

  describe('3.3 Collaborative Arena Contracts', () => {
    it('validates ArenaJoinRoomRequestSchema with default and explicit roles', () => {
      const defaultRoleReq = {
        roomId: 'room-session-123',
      };
      const parsedDefault = ArenaJoinRoomRequestSchema.safeParse(defaultRoleReq);
      expect(parsedDefault.success).toBe(true);
      if (parsedDefault.success) {
        expect(parsedDefault.data.role).toBe(ArenaCollaborativeRole.HOST);
      }

      const mentorReq = {
        roomId: 'room-session-123',
        role: ArenaCollaborativeRole.MENTOR,
        passcode: 'mentor-pin',
      };
      const parsedMentor = ArenaJoinRoomRequestSchema.safeParse(mentorReq);
      expect(parsedMentor.success).toBe(true);
      if (parsedMentor.success) {
        expect(parsedMentor.data.role).toBe('MENTOR');
      }
    });

    it('validates ArenaRoomPresenceSchema with participants', () => {
      const presence = {
        roomId: 'room-session-123',
        hostUserId: 'user-candidate-1',
        activeFile: 'src/solution.ts',
        updatedAt: '2026-10-27T10:00:00.000Z',
        participants: [
          {
            socketId: 'sock-1',
            userId: 'user-candidate-1',
            displayName: 'Candidate Alice',
            role: ArenaCollaborativeRole.HOST,
            color: '#10B981',
            joinedAt: '2026-10-27T09:59:00.000Z',
          },
          {
            socketId: 'sock-2',
            userId: 'user-mentor-1',
            displayName: 'Senior Mentor Bob',
            avatarUrl: 'https://cdn.anyf.io/avatars/bob.png',
            role: ArenaCollaborativeRole.MENTOR,
            color: '#8B5CF6',
            joinedAt: '2026-10-27T10:00:00.000Z',
          },
        ],
      };
      const parsed = ArenaRoomPresenceSchema.safeParse(presence);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.participants).toHaveLength(2);
      }
    });

    it('validates ArenaCursorCoordinatePayloadSchema', () => {
      const cursor = {
        roomId: 'room-session-123',
        userId: 'user-mentor-1',
        file: 'src/solution.ts',
        line: 42,
        column: 15,
        selectionEndLine: 42,
        selectionEndColumn: 25,
        timestamp: 1729000000,
      };
      const parsed = ArenaCursorCoordinatePayloadSchema.safeParse(cursor);
      expect(parsed.success).toBe(true);
    });

    it('validates ArenaCodeChangePayloadSchema', () => {
      const change = {
        roomId: 'room-session-123',
        userId: 'user-candidate-1',
        file: 'src/solution.ts',
        content: 'export function solution() { return true; }',
        version: 3,
        timestamp: 1729000005,
      };
      const parsed = ArenaCodeChangePayloadSchema.safeParse(change);
      expect(parsed.success).toBe(true);
    });

    it('validates ArenaSharedTestBroadcastSchema', () => {
      const broadcast = {
        roomId: 'room-session-123',
        triggeredBy: {
          userId: 'user-candidate-1',
          displayName: 'Candidate Alice',
          role: ArenaCollaborativeRole.HOST,
        },
        commandId: 'cmd-test-1',
        status: ArenaRunStatus.PASSED,
        stdout: '3 passed, 0 failed',
        stderr: '',
        durationMs: 420,
        testsTotal: 3,
        testsPassed: 3,
        testsFailed: 0,
        testResults: [
          {
            suiteName: 'solution.test.ts',
            testName: 'should return true',
            passed: true,
            durationMs: 120,
          },
        ],
        timestamp: 1729000010,
      };
      const parsed = ArenaSharedTestBroadcastSchema.safeParse(broadcast);
      expect(parsed.success).toBe(true);
    });
  });
});
