import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ArenaSessionRepository } from '../repositories/arena-session.repository';
import {
  ArenaChallengeManifest,
  ArenaAiAssistanceMode,
  ArenaActionEventType,
  ErrorCode,
} from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

export interface CopilotQueryRequest {
  sessionId: string;
  userQuestion: string;
  activeFilePath?: string;
  activeFileContent?: string;
  latestErrorLog?: string;
}

export interface CopilotQueryResponse {
  answer: string;
  mode: ArenaAiAssistanceMode;
  suggestedAction?: string;
  timestamp: string;
}

export interface CopilotPatchProposalRequest {
  sessionId: string;
  targetFilePath: string;
  currentContent: string;
  instruction: string;
}

export interface CopilotPatchProposalResponse {
  targetFilePath: string;
  proposedDiff: string;
  proposedContent: string;
  userActionRequired: boolean;
  explanation: string;
}

export interface AiCollaborationEvaluation {
  score: number;
  feedback: string;
  questionsAsked: number;
  testsRunAfterQuestions: number;
}

@Injectable()
export class ArenaCopilotService {
  private readonly logger = new Logger(ArenaCopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionRepo: ArenaSessionRepository,
  ) {}

  /**
   * Sanitizes workspace context to guarantee zero hidden test or reference solution leakage
   */
  public sanitizeContext(
    manifest: ArenaChallengeManifest,
    requestedFiles: Record<string, string>,
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const hiddenSet = new Set(manifest.hiddenFiles || []);

    for (const [path, content] of Object.entries(requestedFiles)) {
      const lower = path.toLowerCase();
      const isRestricted =
        hiddenSet.has(path) ||
        lower.includes('hidden') ||
        lower.includes('.env') ||
        lower.includes('reference') ||
        lower.includes('solution') ||
        lower.includes('secret') ||
        lower.includes('.pem') ||
        lower.includes('private_key');

      // Guardrail: Never expose hidden test files, reference solution, or secrets to AI copilot context
      if (!isRestricted) {
        sanitized[path] = content;
      }
    }
    return sanitized;
  }

  async askCopilot(userId: string, request: CopilotQueryRequest): Promise<CopilotQueryResponse> {
    const session = await this.sessionRepo.findSessionById(request.sessionId, userId);
    if (!session) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Session '${request.sessionId}' not found or access denied.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const manifest = session.challengeVersion.manifestJson as unknown as ArenaChallengeManifest;
    const mode =
      (session.aiAssistanceMode as ArenaAiAssistanceMode) || ArenaAiAssistanceMode.HINTS_ONLY;

    if (mode === ArenaAiAssistanceMode.DISABLED) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'AI Copilot is disabled for this benchmark session.',
        HttpStatus.FORBIDDEN,
      );
    }

    // 1. Sanitize file context if provided
    let contextSnippet = '';
    if (request.activeFilePath && request.activeFileContent) {
      const sanitized = this.sanitizeContext(manifest, {
        [request.activeFilePath]: request.activeFileContent,
      });
      if (sanitized[request.activeFilePath]) {
        contextSnippet = `\nActive file: ${request.activeFilePath}\n\`\`\`\n${sanitized[request.activeFilePath]}\n\`\`\``;
      }
    }

    // 2. Guard against leakage attempts for hidden tests or reference solutions
    const lowerQuestion = (request.userQuestion || '').toLowerCase();
    const isLeakAttempt =
      lowerQuestion.includes('hidden') ||
      lowerQuestion.includes('reference') ||
      lowerQuestion.includes('solution') ||
      lowerQuestion.includes('secret') ||
      lowerQuestion.includes('exploit') ||
      lowerQuestion.includes('override') ||
      lowerQuestion.includes('dan mode');

    let guidance = '';
    if (isLeakAttempt) {
      if (mode === ArenaAiAssistanceMode.HINTS_ONLY) {
        guidance = `[Hint] Hidden verification test assertions and reference solutions are sealed to preserve benchmark integrity. Focus on fulfilling the domain requirements in the visible workspace files.`;
      } else if (mode === ArenaAiAssistanceMode.EXPLANATION) {
        guidance = `[Analysis] Direct inspection of reference solutions or hidden verification suites is restricted. Analyze the public error logs and review system boundary invariants in your implementation.`;
      } else {
        guidance = `[Pairing Guidance] We cannot disclose hidden verification suites or reference solutions. Let's reason about the functional contract: verify input validation and boundary preconditions.`;
      }
    } else {
      // 3. Generate guidance based on assistance mode
      if (mode === ArenaAiAssistanceMode.HINTS_ONLY) {
        guidance = `[Hint] Consider how resource lifecycle or authorization scoping applies to this flow. Check if ownership is validated before mutations occur.`;
      } else if (mode === ArenaAiAssistanceMode.EXPLANATION) {
        guidance = `[Analysis] The error indicates an unhandled invariant. Ensure that boundary edge cases are checked and locks/transactions prevent concurrent race conditions.${contextSnippet ? '\nReview the highlighted file context for missing ownership validation.' : ''}`;
      } else {
        guidance = `[Pairing Guidance] Let's analyze the failure: "${request.userQuestion}". Verify that state transitions strictly check preconditions.`;
      }
    }

    // 3. Record interaction audit event
    await this.sessionRepo.recordActionEvent({
      sessionId: session.id,
      eventType: ArenaActionEventType.AI_QUESTION_SENT as any,
      metadata: {
        userQuestion: request.userQuestion,
        mode,
        guidanceLength: guidance.length,
      },
    });

    return {
      answer: guidance,
      mode,
      suggestedAction: 'Review the identified boundary condition and run unit tests.',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * ARENA-095: Optional controlled patch proposal workflow
   * Proposes a patch diff for user review; never mutates the file directly.
   */
  async proposePatch(
    userId: string,
    request: CopilotPatchProposalRequest,
  ): Promise<CopilotPatchProposalResponse> {
    const session = await this.sessionRepo.findSessionById(request.sessionId, userId);
    if (!session) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Session '${request.sessionId}' not found or access denied.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const manifest = session.challengeVersion.manifestJson as unknown as ArenaChallengeManifest;
    const mode =
      (session.aiAssistanceMode as ArenaAiAssistanceMode) || ArenaAiAssistanceMode.HINTS_ONLY;

    if (mode === ArenaAiAssistanceMode.DISABLED) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'AI Copilot is disabled for this session.',
        HttpStatus.FORBIDDEN,
      );
    }

    // Guardrail: Block hidden test files, reference solution, and secrets
    const hiddenSet = new Set(manifest.hiddenFiles || []);
    const lowerTarget = request.targetFilePath.toLowerCase();
    const isTargetRestricted =
      hiddenSet.has(request.targetFilePath) ||
      lowerTarget.includes('hidden') ||
      lowerTarget.includes('.env') ||
      lowerTarget.includes('reference') ||
      lowerTarget.includes('solution') ||
      lowerTarget.includes('secret') ||
      lowerTarget.includes('.pem') ||
      lowerTarget.includes('private_key');

    if (isTargetRestricted) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Cannot propose patch for hidden, reference solution, or restricted verification files.',
        HttpStatus.FORBIDDEN,
      );
    }

    const proposedAddition = `\n// [AI Proposed Fix: ${request.instruction}]\n// Please review invariants before manual application.\n`;
    const proposedContent = `${request.currentContent}${proposedAddition}`;
    const proposedDiff = `--- a/${request.targetFilePath}\n+++ b/${request.targetFilePath}\n@@ -1,1 +1,4 @@\n ${request.currentContent.slice(0, 40)}...\n+${proposedAddition.trim()}`;

    // Record interaction audit event
    await this.sessionRepo.recordActionEvent({
      sessionId: session.id,
      eventType: ArenaActionEventType.AI_QUESTION_SENT as any,
      metadata: {
        action: 'PATCH_PROPOSAL',
        targetFilePath: request.targetFilePath,
        instruction: request.instruction,
        userActionRequired: true,
      },
    });

    return {
      targetFilePath: request.targetFilePath,
      proposedDiff,
      proposedContent,
      userActionRequired: true,
      explanation: `Proposed patch addresses: "${request.instruction}". Review differences and verify with test suite.`,
    };
  }

  /**
   * ARENA-093: AI verification-quality rubric experiment
   * Evaluates if candidate verified AI assistance with tests rather than blind acceptance.
   */
  evaluateAiCollaboration(
    events: Array<{ eventType: string; createdAt: Date }>,
  ): AiCollaborationEvaluation {
    const aiQuestions = events.filter(
      e => e.eventType === 'AI_QUESTION_SENT' || e.eventType === 'AI_PATCH_PROPOSED',
    );
    if (aiQuestions.length === 0) {
      return {
        score: 100,
        feedback: 'No AI assistance requested. Independent implementation.',
        questionsAsked: 0,
        testsRunAfterQuestions: 0,
      };
    }

    const latestQuestionTime = Math.max(...aiQuestions.map(q => new Date(q.createdAt).getTime()));
    const testsRunAfter = events.filter(
      e =>
        (e.eventType === 'EXECUTION_RUN' || e.eventType === 'COMMAND_EXECUTION') &&
        new Date(e.createdAt).getTime() > latestQuestionTime,
    );

    if (testsRunAfter.length > 0) {
      const score = Math.min(100, 75 + testsRunAfter.length * 10);
      return {
        score,
        feedback:
          'Candidate effectively queried AI Copilot and tested proposed changes before submission.',
        questionsAsked: aiQuestions.length,
        testsRunAfterQuestions: testsRunAfter.length,
      };
    }

    return {
      score: 45,
      feedback: 'Candidate accepted AI suggestions without testing before submission.',
      questionsAsked: aiQuestions.length,
      testsRunAfterQuestions: 0,
    };
  }
}
