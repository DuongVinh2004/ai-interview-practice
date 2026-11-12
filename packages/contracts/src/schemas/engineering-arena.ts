import { z } from 'zod';
import {
  ChallengeStatus,
  ChallengeDomain,
  ChallengeCategory,
  ArenaSessionState,
  ArenaRunStatus,
  ArenaActionEventType,
  ArenaAiAssistanceMode,
  ArenaSandboxMode,
  ArenaCollaborativeRole,
} from '../enums';

// ---------------------------------------------------------------------------
// Manifest & Challenge Schemas
// ---------------------------------------------------------------------------

export const ArenaCommandDefinitionSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  command: z.string().min(1).max(500),
  args: z.array(z.string()).default([]),
  timeoutSeconds: z.number().int().min(1).max(120).default(15),
  isVerification: z.boolean().default(false),
});
export type ArenaCommandDefinition = z.infer<typeof ArenaCommandDefinitionSchema>;

export const ArenaChallengeManifestSchema = z.object({
  schemaVersion: z.literal('1.0'),
  slug: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  domain: z.nativeEnum(ChallengeDomain),
  category: z.nativeEnum(ChallengeCategory),
  difficulty: z.number().int().min(1).max(5).default(3),
  estimatedMinutes: z.number().int().min(5).max(180).default(45),
  environment: z.object({
    runtime: z.string().min(1).max(50), // e.g. "node:22", "python:3.12"
    entrypoint: z.string().max(255).optional(),
    memoryLimitMb: z.number().int().min(64).max(2048).default(512),
    cpuLimit: z.number().min(0.1).max(4.0).default(1.0),
  }),
  visibleFiles: z.array(z.string()).default([]),
  editableFiles: z.array(z.string()).default([]),
  hiddenFiles: z.array(z.string()).default([]),
  commands: z.array(ArenaCommandDefinitionSchema).min(1),
  rubric: z.object({
    version: z.string().default('1.0'),
    objectiveWeight: z.number().min(0).max(1).default(0.7),
    rubricWeight: z.number().min(0).max(1).default(0.3),
    criteria: z
      .array(
        z.object({
          key: z.string(),
          name: z.string(),
          description: z.string(),
          maxPoints: z.number().int().min(1).max(100),
        }),
      )
      .default([]),
  }),
  skills: z
    .array(
      z.object({
        taxonomyKey: z.string(),
        weight: z.number().min(0).max(1).default(1.0),
      }),
    )
    .default([]),
});
export type ArenaChallengeManifest = z.infer<typeof ArenaChallengeManifestSchema>;

export const ChallengeSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  domain: z.nativeEnum(ChallengeDomain),
  category: z.nativeEnum(ChallengeCategory),
  difficulty: z.number().int().min(1).max(5),
  estimatedMinutes: z.number().int(),
  status: z.nativeEnum(ChallengeStatus),
  activeVersion: z.number().int().default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ChallengeSummary = z.infer<typeof ChallengeSummarySchema>;

export const ChallengeDetailSchema = ChallengeSummarySchema.extend({
  description: z.string(),
  instructions: z.string().optional(),
  editableFiles: z.array(z.string()),
  commands: z.array(ArenaCommandDefinitionSchema),
});
export type ChallengeDetail = z.infer<typeof ChallengeDetailSchema>;

// ---------------------------------------------------------------------------
export type ArenaFileNode = {
  path: string;
  name: string;
  isDirectory: boolean;
  isEditable: boolean;
  children?: ArenaFileNode[];
};

export const ArenaFileNodeSchema: z.ZodType<ArenaFileNode> = z.lazy(() =>
  z.object({
    path: z.string(),
    name: z.string(),
    isDirectory: z.boolean(),
    isEditable: z.boolean(),
    children: z.array(ArenaFileNodeSchema).optional(),
  }),
);

export const ArenaActionEventSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  eventType: z.nativeEnum(ArenaActionEventType),
  occurredAt: z.string().datetime(),
  sequence: z.number().int().min(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
  artifactRef: z.string().nullable().optional(),
  traceId: z.string().nullable().optional(),
});
export type ArenaActionEvent = z.infer<typeof ArenaActionEventSchema>;

export const ArenaWorkspaceFileUpdateSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});
export type ArenaWorkspaceFileUpdate = z.infer<typeof ArenaWorkspaceFileUpdateSchema>;

export const ArenaWorkspaceSyncRequestSchema = z.object({
  files: z.array(ArenaWorkspaceFileUpdateSchema).min(1),
});
export type ArenaWorkspaceSyncRequest = z.infer<typeof ArenaWorkspaceSyncRequestSchema>;

// ---------------------------------------------------------------------------
// Session Schemas
// ---------------------------------------------------------------------------

export const StartArenaSessionRequestSchema = z.object({
  challengeSlug: z.string().min(1),
  aiAssistanceMode: z.nativeEnum(ArenaAiAssistanceMode).default(ArenaAiAssistanceMode.HINTS_ONLY),
});
export type StartArenaSessionRequest = z.infer<typeof StartArenaSessionRequestSchema>;

export const ArenaSessionResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  challengeSlug: z.string(),
  challengeTitle: z.string(),
  challengeDomain: z.nativeEnum(ChallengeDomain),
  challengeCategory: z.nativeEnum(ChallengeCategory),
  state: z.nativeEnum(ArenaSessionState),
  sandboxMode: z.nativeEnum(ArenaSandboxMode),
  aiAssistanceMode: z.nativeEnum(ArenaAiAssistanceMode),
  files: z.array(ArenaFileNodeSchema),
  initialFileContents: z.record(z.string(), z.string()),
  startedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().optional(),
  submittedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});
export type ArenaSessionResponse = z.infer<typeof ArenaSessionResponseSchema>;

// ---------------------------------------------------------------------------
// Execution & Test Run Schemas
// ---------------------------------------------------------------------------

export const ArenaTestResultSchema = z.object({
  suiteName: z.string(),
  testName: z.string(),
  passed: z.boolean(),
  durationMs: z.number().int().min(0),
  errorMsg: z.string().nullable().optional(),
});
export type ArenaTestResult = z.infer<typeof ArenaTestResultSchema>;

export const ArenaRunCommandRequestSchema = z.object({
  commandId: z.string().min(1),
  modifiedFiles: z.array(ArenaWorkspaceFileUpdateSchema).optional(),
});
export type ArenaRunCommandRequest = z.infer<typeof ArenaRunCommandRequestSchema>;

export const ArenaExecutionRunResponseSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  commandId: z.string(),
  status: z.nativeEnum(ArenaRunStatus),
  exitCode: z.number().int().nullable().optional(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number().int(),
  testsTotal: z.number().int().default(0),
  testsPassed: z.number().int().default(0),
  testsFailed: z.number().int().default(0),
  testResults: z.array(ArenaTestResultSchema).default([]),
  createdAt: z.string().datetime(),
});
export type ArenaExecutionRunResponse = z.infer<typeof ArenaExecutionRunResponseSchema>;

// ---------------------------------------------------------------------------
// Submission & Evaluation Schemas
// ---------------------------------------------------------------------------

export const ArenaSubmitSolutionRequestSchema = z.object({
  explanation: z.string().max(5000).optional(),
  finalFiles: z.array(ArenaWorkspaceFileUpdateSchema).min(1),
});
export type ArenaSubmitSolutionRequest = z.infer<typeof ArenaSubmitSolutionRequestSchema>;

export const ArenaScoreBreakdownSchema = z.object({
  objectiveScore: z.number().min(0).max(100),
  rubricScore: z.number().min(0).max(100),
  finalScore: z.number().min(0).max(100),
  scoreCapApplied: z.boolean().default(false),
  scoreCapReason: z.string().nullable().optional(),
  testsVisiblePassed: z.number().int(),
  testsVisibleTotal: z.number().int(),
  testsHiddenPassed: z.number().int(),
  testsHiddenTotal: z.number().int(),
});
export type ArenaScoreBreakdown = z.infer<typeof ArenaScoreBreakdownSchema>;

export const ArenaSkillEvidenceDtoSchema = z.object({
  taxonomyKey: z.string(),
  evidenceType: z.string(),
  scoreContribution: z.number(),
  confidence: z.number().min(0).max(1),
  sourceSummary: z.string(),
});
export type ArenaSkillEvidenceDto = z.infer<typeof ArenaSkillEvidenceDtoSchema>;

export const ArenaEvaluationResponseSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  submissionId: z.string().uuid(),
  scoreBreakdown: ArenaScoreBreakdownSchema,
  aiFeedbackSummary: z.string(),
  rubricCriteriaFeedback: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      score: z.number(),
      maxPoints: z.number(),
      feedback: z.string(),
    }),
  ),
  skillEvidences: z.array(ArenaSkillEvidenceDtoSchema),
  forensicRiskScore: z.number().min(0).max(100).optional(),
  evaluatedAt: z.string().datetime(),
});
export type ArenaEvaluationResponse = z.infer<typeof ArenaEvaluationResponseSchema>;

// ---------------------------------------------------------------------------
// Anti-Cheat & Forensic Plagiarism Schemas
// ---------------------------------------------------------------------------

export const CodeSimilarityMatchSchema = z.object({
  targetSessionId: z.string().optional(),
  targetFile: z.string().min(1),
  sourceFile: z.string().min(1),
  similarityScore: z.number().min(0).max(1),
  matchedFingerprints: z.number().int().min(0),
  totalFingerprints: z.number().int().min(0),
  matchedLines: z.array(z.tuple([z.number().int(), z.number().int()])).optional(),
  evidence: z.string().optional(),
});
export type CodeSimilarityMatch = z.infer<typeof CodeSimilarityMatchSchema>;

export const PlagiarismReportSchema = z.object({
  sessionId: z.string(),
  isPlagiarized: z.boolean(),
  highestSimilarityScore: z.number().min(0).max(1),
  forensicRiskScore: z.number().min(0).max(100).default(0),
  matches: z.array(CodeSimilarityMatchSchema).default([]),
  analyzedAt: z.string().datetime(),
});
export type PlagiarismReport = z.infer<typeof PlagiarismReportSchema>;

export const ArenaAntiCheatFlagSchema = z.object({
  ruleId: z.string(),
  description: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ArenaAntiCheatFlag = z.infer<typeof ArenaAntiCheatFlagSchema>;

export const ArenaAntiCheatReportSchema = z.object({
  sessionId: z.string(),
  isSuspicious: z.boolean(),
  riskScore: z.number().min(0).max(100),
  flags: z.array(ArenaAntiCheatFlagSchema),
  plagiarismReport: PlagiarismReportSchema.optional(),
  analyzedAt: z.string().datetime(),
});
export type ArenaAntiCheatReport = z.infer<typeof ArenaAntiCheatReportSchema>;

export const ArenaAnalyzeAntiCheatRequestSchema = z.object({
  candidateFiles: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string(),
      }),
    )
    .optional(),
  comparisonSnippets: z
    .array(
      z.object({
        sourceId: z.string().optional(),
        file: z.string().min(1),
        content: z.string(),
      }),
    )
    .optional(),
  kGramSize: z.number().int().min(2).max(100).optional(),
  windowSize: z.number().int().min(1).max(50).optional(),
});
export type ArenaAnalyzeAntiCheatRequest = z.infer<typeof ArenaAnalyzeAntiCheatRequestSchema>;

// ---------------------------------------------------------------------------
// 3.3 Collaborative Engineering Arena (Multiplayer / Mentor Room) Schemas
// ---------------------------------------------------------------------------

export const ArenaJoinRoomRequestSchema = z.object({
  roomId: z.string().min(1),
  role: z.nativeEnum(ArenaCollaborativeRole).default(ArenaCollaborativeRole.HOST),
  passcode: z.string().optional(),
});
export type ArenaJoinRoomRequest = z.infer<typeof ArenaJoinRoomRequestSchema>;

export const ArenaCollaborativeParticipantSchema = z.object({
  socketId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  role: z.nativeEnum(ArenaCollaborativeRole),
  color: z.string(),
  joinedAt: z.string().datetime(),
});
export type ArenaCollaborativeParticipant = z.infer<typeof ArenaCollaborativeParticipantSchema>;

export const ArenaRoomPresenceSchema = z.object({
  roomId: z.string(),
  hostUserId: z.string(),
  participants: z.array(ArenaCollaborativeParticipantSchema),
  activeFile: z.string().optional(),
  updatedAt: z.string().datetime(),
});
export type ArenaRoomPresence = z.infer<typeof ArenaRoomPresenceSchema>;

export const ArenaCursorCoordinatePayloadSchema = z.object({
  roomId: z.string(),
  userId: z.string(),
  file: z.string().min(1),
  line: z.number().int().min(1),
  column: z.number().int().min(1),
  selectionEndLine: z.number().int().min(1).optional(),
  selectionEndColumn: z.number().int().min(1).optional(),
  timestamp: z.number(),
});
export type ArenaCursorCoordinatePayload = z.infer<typeof ArenaCursorCoordinatePayloadSchema>;

export const ArenaCodeChangePayloadSchema = z.object({
  roomId: z.string(),
  userId: z.string(),
  file: z.string().min(1),
  content: z.string(),
  patch: z.string().optional(),
  version: z.number().int().min(0),
  timestamp: z.number(),
});
export type ArenaCodeChangePayload = z.infer<typeof ArenaCodeChangePayloadSchema>;

export const ArenaSharedTestBroadcastSchema = z.object({
  roomId: z.string(),
  triggeredBy: z.object({
    userId: z.string(),
    displayName: z.string(),
    role: z.nativeEnum(ArenaCollaborativeRole),
  }),
  commandId: z.string(),
  status: z.nativeEnum(ArenaRunStatus),
  stdout: z.string().default(''),
  stderr: z.string().default(''),
  durationMs: z.number().int().default(0),
  testsTotal: z.number().int().default(0),
  testsPassed: z.number().int().default(0),
  testsFailed: z.number().int().default(0),
  testResults: z.array(ArenaTestResultSchema).default([]),
  timestamp: z.number(),
});
export type ArenaSharedTestBroadcast = z.infer<typeof ArenaSharedTestBroadcastSchema>;
