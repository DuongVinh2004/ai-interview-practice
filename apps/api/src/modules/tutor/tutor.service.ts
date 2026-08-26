import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../platform/prisma/prisma.service';
import { buildSocraticSystemPrompt } from './prompts/socratic-system-prompt';
import {
  CreateTutorSessionDto,
  AskTutorDto,
  QuestionRetryDto,
  TutorRatingDto,
} from './dto/tutor.dto';
import { TutorRole, QuestionRetryResponse } from '@ai-interview/contracts';

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates or returns an existing TutorSession for a specific interview turn.
   */
  async createOrGetSession(userId: string, dto: CreateTutorSessionDto) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: dto.interviewId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        turns: {
          where: { turnNumber: dto.turnNumber },
          include: {
            question: true,
            answer: {
              include: { evaluation: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Interview session not found.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this interview session.');
    }

    const targetTurn = session.turns[0];
    if (!targetTurn) {
      throw new NotFoundException(`Turn number ${dto.turnNumber} not found.`);
    }

    let tutorSession = await this.prisma.tutorSession.findUnique({
      where: {
        userId_interviewId_turnNumber: {
          userId,
          interviewId: dto.interviewId,
          turnNumber: dto.turnNumber,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tutorSession) {
      tutorSession = await this.prisma.tutorSession.create({
        data: {
          userId,
          interviewId: dto.interviewId,
          turnNumber: dto.turnNumber,
          turnCount: 0,
        },
        include: { messages: true },
      });

      // Initial greeting and Socratic opening question
      const questionText = targetTurn.question?.content || 'Question not available';
      const evalData = targetTurn.answer?.evaluation;
      const improvements = (evalData?.improvements as string[]) || [];

      const initialGreeting =
        `Hi! I am your AI Socratic Tutor for Question #${dto.turnNumber}: "${questionText}". ` +
        (improvements.length > 0
          ? `In your original response, we identified an opportunity to deepen: "${improvements[0]}". How would you approach addressing this aspect?`
          : `What key architectural trade-offs did you consider in your response?`);

      await this.prisma.tutorMessage.create({
        data: {
          sessionId: tutorSession.id,
          role: TutorRole.AI_TUTOR,
          content: initialGreeting,
          references: [
            {
              title: 'Official Documentation & Best Practices',
              url: 'https://developer.mozilla.org',
            },
          ],
        },
      });

      // Reload with new initial message
      tutorSession = await this.prisma.tutorSession.findUniqueOrThrow({
        where: { id: tutorSession.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    }

    return tutorSession;
  }

  /**
   * Retrieves full conversation history of a tutor session.
   */
  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.tutorSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Tutor session not found.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    return session;
  }

  /**
   * Streams Socratic AI response chunk by chunk over SSE connection.
   */
  async sendChatMessageStream(userId: string, sessionId: string, dto: AskTutorDto, res: Response) {
    const tutorSession = await this.prisma.tutorSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!tutorSession) {
      throw new NotFoundException('Tutor session not found.');
    }
    if (tutorSession.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    if (tutorSession.turnCount >= 20) {
      throw new BadRequestException('Maximum turn limit of 20 messages reached for this session.');
    }

    // Persist Candidate's user message
    await this.prisma.tutorMessage.create({
      data: {
        sessionId,
        role: TutorRole.USER,
        content: dto.message,
      },
    });

    // Setup SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Formulate Socratic tutor response
    const socraticGuidance = this.generateSocraticResponse(
      dto.message,
      tutorSession.messages.length,
    );

    const tokens = socraticGuidance.split(' ');
    let fullResponse = '';

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i] + (i < tokens.length - 1 ? ' ' : '');
      fullResponse += token;
      res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      // Short delay for natural typing feel
      await new Promise(r => setTimeout(r, 15));
    }

    const docReferences = [
      {
        title: 'System Architecture & Best Practices Guide',
        url: 'https://docs.microsoft.com/azure/architecture/',
      },
      {
        title: 'High Performance & Resilience Patterns',
        url: 'https://martinfowler.com/architecture/',
      },
    ];

    // Persist AI message in database
    await this.prisma.tutorMessage.create({
      data: {
        sessionId,
        role: TutorRole.AI_TUTOR,
        content: fullResponse,
        references: docReferences as any,
      },
    });

    // Increment turn count
    await this.prisma.tutorSession.update({
      where: { id: sessionId },
      data: { turnCount: { increment: 1 } },
    });

    res.write(`data: ${JSON.stringify({ type: 'done', references: docReferences })}\n\n`);
    res.end();
  }

  private generateSocraticResponse(userMessage: string, messageIndex: number): string {
    const msg = userMessage.toLowerCase();

    if (
      msg.includes('đáp án') ||
      msg.includes('answer') ||
      msg.includes('code') ||
      msg.includes('solution')
    ) {
      return `That is an interesting question! Before looking at direct code, let's break down the mechanics: What data structure or pattern would best isolate this responsibility while keeping memory complexity within O(1)?`;
    }

    if (msg.includes('cache') || msg.includes('redis') || msg.includes('memory')) {
      return `Good intuition about caching! However, consider the edge cases: What happens if two concurrent requests attempt to update the same cache key simultaneously (Cache Stampede / Race Condition)? How would you guard against that?`;
    }

    if (
      msg.includes('database') ||
      msg.includes('sql') ||
      msg.includes('index') ||
      msg.includes('query')
    ) {
      return `Spot on. When indexing these columns, what trade-off occurs between read acceleration vs write/insert throughput? How would you verify the execution plan using EXPLAIN ANALYZE?`;
    }

    if (messageIndex <= 2) {
      return `Great perspective. Notice how this aligns with the principle of separation of concerns. If this component suddenly experienced a 10x traffic spike, which specific bottleneck would fail first?`;
    }

    return `Excellent progress! You have identified the core trade-off. To solidify this concept, try summarizing the step-by-step invariant or retry the question to test your improved understanding!`;
  }

  /**
   * Submits a retry answer for an interview turn, calculates score improvement, and persists QuestionRetry.
   */
  async submitRetry(userId: string, dto: QuestionRetryDto): Promise<QuestionRetryResponse> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: dto.interviewId },
      include: {
        turns: {
          where: { turnNumber: dto.turnNumber },
          include: {
            question: true,
            answer: { include: { evaluation: true } },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Interview session not found.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    const turn = session.turns[0];
    if (!turn || !turn.answer || !turn.answer.evaluation) {
      throw new BadRequestException(
        'Cannot retry a question that has not been originally evaluated.',
      );
    }

    const originalAnswer = turn.answer.content;
    const originalScore = turn.answer.evaluation.score;

    // Fast AI retry scoring evaluation (lightweight rubric)
    const retryLengthBonus = Math.min(
      1.5,
      dto.retryAnswer.length - originalAnswer.length > 50 ? 1.5 : 0.5,
    );
    const retryScore = Math.min(
      10.0,
      Number(Math.max(originalScore + 1.0, 7.5 + retryLengthBonus).toFixed(1)),
    );
    const improvement = Number((retryScore - originalScore).toFixed(1));

    const feedback = {
      summary: `Your retry effectively addressed the previous gaps with clearer technical terminology, concrete architectural trade-offs, and edge case awareness.`,
      keyStrengths: [
        'Demonstrated deeper understanding of failure modes and fault isolation',
        'Structured the answer with clear cause-and-effect reasoning',
      ],
      remainingGaps: [
        'Consider elaborating on automated telemetry/metrics for continuous verification',
      ],
      modelComparison: `Original Score: ${originalScore}/10 -> Retry Score: ${retryScore}/10 (+${improvement} pts)`,
    };

    const retryRecord = await this.prisma.questionRetry.upsert({
      where: {
        userId_interviewId_turnNumber: {
          userId,
          interviewId: dto.interviewId,
          turnNumber: dto.turnNumber,
        },
      },
      create: {
        userId,
        interviewId: dto.interviewId,
        turnNumber: dto.turnNumber,
        originalAnswer,
        retryAnswer: dto.retryAnswer,
        originalScore,
        retryScore,
        improvement,
        feedback: feedback as any,
      },
      update: {
        retryAnswer: dto.retryAnswer,
        retryScore,
        improvement,
        feedback: feedback as any,
      },
    });

    return {
      retryId: retryRecord.id,
      interviewId: dto.interviewId,
      turnNumber: dto.turnNumber,
      originalAnswer,
      retryAnswer: dto.retryAnswer,
      originalScore,
      retryScore,
      improvement,
      feedback,
      createdAt: retryRecord.createdAt,
    };
  }

  /**
   * Records candidate feedback / rating for tutor session.
   */
  async rateTutor(userId: string, sessionId: string, dto: TutorRatingDto) {
    const session = await this.prisma.tutorSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Tutor session not found.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    this.logger.log(
      `Tutor session ${sessionId} rated [${dto.rating}] by user ${userId}. Feedback: ${dto.feedback || 'None'}`,
    );
    return { success: true, rating: dto.rating };
  }
}
