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

@Injectable()
export class ArenaCopilotService {
  private readonly logger = new Logger(ArenaCopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionRepo: ArenaSessionRepository,
  ) {}

  /**
   * Sanitizes workspace context to guarantee zero hidden test or secret leakage
   */
  public sanitizeContext(
    manifest: ArenaChallengeManifest,
    requestedFiles: Record<string, string>,
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const hiddenSet = new Set(manifest.hiddenFiles || []);

    for (const [path, content] of Object.entries(requestedFiles)) {
      // Guardrail: Never expose hidden test files or secrets to AI copilot context
      if (!hiddenSet.has(path) && !path.includes('hidden') && !path.includes('.env')) {
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

    // 2. Generate guidance based on assistance mode
    let guidance = '';
    if (mode === ArenaAiAssistanceMode.HINTS_ONLY) {
      guidance = `[Hint] Consider how resource lifecycle or authorization scoping applies to this flow. Check if ownership is validated before mutations occur.`;
    } else if (mode === ArenaAiAssistanceMode.EXPLANATION) {
      guidance = `[Analysis] The error indicates an unhandled invariant. Ensure that boundary edge cases are checked and locks/transactions prevent concurrent race conditions.${contextSnippet ? '\nReview the highlighted file context for missing ownership validation.' : ''}`;
    } else {
      guidance = `[Pairing Guidance] Let's analyze the failure: "${request.userQuestion}". Verify that state transitions strictly check preconditions.`;
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
}
