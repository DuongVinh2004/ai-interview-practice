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
import { AiOrchestratorService } from '../ai-orchestrator/ai-orchestrator.service';

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AiOrchestratorService,
  ) {}

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

    // Fetch interview context for Socratic system prompt
    const interviewSession = await this.prisma.interviewSession.findUnique({
      where: { id: tutorSession.interviewId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        turns: {
          where: { turnNumber: tutorSession.turnNumber },
          include: {
            question: true,
            answer: { include: { evaluation: true } },
          },
        },
      },
    });

    const targetTurn = interviewSession?.turns[0];
    const evalData = targetTurn?.answer?.evaluation;
    const chatHistory = tutorSession.messages.map(m => ({
      role: m.role as any,
      content: m.content,
    }));

    const socraticContext = {
      role: interviewSession?.jobRole?.name || 'Software Engineer',
      level: interviewSession?.seniorityLevel?.name || 'Mid-Level',
      question: targetTurn?.question?.content || 'Interview Question',
      originalAnswer: targetTurn?.answer?.content || '',
      score: evalData?.score || 5.0,
      strengths: (evalData?.strengths as string[]) || [],
      improvements: (evalData?.improvements as string[]) || [],
      keyFocus: targetTurn?.question?.keyFocus || undefined,
      userMessage: dto.message,
      chatHistory,
    };

    const systemPrompt = buildSocraticSystemPrompt(socraticContext);

    let fullResponse = '';
    const aiResult = await this.aiOrchestrator.streamSocraticChat(
      tutorSession.interviewId,
      socraticContext,
      systemPrompt,
      token => {
        fullResponse += token;
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      },
    );

    const docReferences = aiResult.data.references || [
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
        content: fullResponse || aiResult.data.fullText,
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

  /**
   * Submits a retry answer for an interview turn, calculates score improvement using AI evaluation rubric, and persists QuestionRetry.
   */
  async submitRetry(userId: string, dto: QuestionRetryDto): Promise<QuestionRetryResponse> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: dto.interviewId },
      include: {
        jobRole: true,
        seniorityLevel: true,
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

    // Genuine AI evaluation based on standard technical rubric (Technical Accuracy, Depth, Clarity)
    const evalResult = await this.aiOrchestrator.evaluateAnswer(session.id, {
      role: session.jobRole?.name || 'Software Engineer',
      level: session.seniorityLevel?.name || 'Mid-Level',
      question: turn.question?.content || '',
      keyFocus: turn.question?.keyFocus || undefined,
      expectedPoints: (turn.question?.expectedPoints as string[]) || undefined,
      answer: dto.retryAnswer,
    });

    const retryScore = Number(evalResult.score.toFixed(1));
    const improvement = Number((retryScore - originalScore).toFixed(1));

    const feedback = {
      summary:
        evalResult.conciseFeedback ||
        `Your retry effectively addressed previous gaps with clear technical reasoning and architectural considerations.`,
      keyStrengths: evalResult.strengths || [],
      remainingGaps: evalResult.improvements || [],
      modelComparison: `Original Score: ${originalScore}/10 -> Retry Score: ${retryScore}/10 (${improvement >= 0 ? '+' : ''}${improvement} pts)`,
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
