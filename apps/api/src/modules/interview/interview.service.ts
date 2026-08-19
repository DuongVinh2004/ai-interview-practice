import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../platform/prisma/prisma.service';
import { SseService } from '../platform/sse/sse.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { SessionStateMachine } from './state-machine/session-state-machine';
import {
  SessionState,
  QueueName,
  JobName,
  SseEventType,
  ErrorCode,
  UserRole,
  DifficultyLevel,
} from '@ai-interview/contracts';
import { CreateInterviewRequestDto, SubmitAnswerRequestDto } from './dto/interview.dto';

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: SseService,
    @InjectQueue(QueueName.QUESTION_GENERATION)
    private readonly questionQueue: Queue,
    @InjectQueue(QueueName.ANSWER_EVALUATION)
    private readonly evaluationQueue: Queue,
  ) {}

  async createSession(userId: string, dto: CreateInterviewRequestDto) {
    const jobRole = await this.prisma.jobRole.findUnique({
      where: { id: dto.jobRoleId, isActive: true },
    });
    if (!jobRole) {
      throw new DomainException(ErrorCode.RESOURCE_NOT_FOUND, 'Job role not found or inactive');
    }

    const seniorityLevel = await this.prisma.seniorityLevel.findUnique({
      where: { id: dto.seniorityLevelId, isActive: true },
    });
    if (!seniorityLevel) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Seniority level not found or inactive',
      );
    }

    const technologies = await this.prisma.technology.findMany({
      where: { id: { in: dto.technologyIds }, isActive: true },
    });
    if (technologies.length !== dto.technologyIds.length) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'One or more selected technologies were not found',
      );
    }

    // Create session, technologies join, and 5 turn rows
    const session = await this.prisma.interviewSession.create({
      data: {
        userId,
        jobRoleId: dto.jobRoleId,
        seniorityLevelId: dto.seniorityLevelId,
        state: SessionState.CREATED,
        currentTurn: 1,
        totalTurns: 5,
        targetDifficulty: 1,
        technologies: {
          create: dto.technologyIds.map(techId => ({
            technologyId: techId,
          })),
        },
        turns: {
          create: [1, 2, 3, 4, 5].map(turnNum => ({
            turnNumber: turnNum,
            difficulty: 1,
            status: 'PENDING',
          })),
        },
      },
      include: {
        jobRole: true,
        seniorityLevel: true,
        technologies: { include: { technology: true } },
        turns: {
          orderBy: { turnNumber: 'asc' },
        },
      },
    });

    const firstTurn = session.turns.find(t => t.turnNumber === 1);
    if (!firstTurn) {
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Failed to initialize interview turns',
      );
    }

    // Enqueue generation of 1st question with deterministic job ID
    const jobId = `question-${session.id}-turn-1`;
    await this.questionQueue.add(
      JobName.GENERATE_QUESTION,
      {
        sessionId: session.id,
        turnId: firstTurn.id,
        turnNumber: 1,
        difficulty: 1,
      },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    this.logger.log(
      `Session ${session.id} created. Question 1 generation enqueued (Job: ${jobId})`,
    );

    this.sseService.emitSessionEvent(session.id, SseEventType.SESSION_UPDATED, {
      sessionId: session.id,
      state: session.state,
      currentTurn: 1,
    });

    return this.mapToSessionDto(session);
  }

  async getSession(userId: string, userRole: UserRole, sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        technologies: { include: { technology: true } },
        turns: {
          orderBy: { turnNumber: 'asc' },
          include: {
            question: true,
            answer: {
              include: { evaluation: true },
            },
          },
        },
        learningPath: {
          include: {
            items: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!session) {
      throw new DomainException(
        ErrorCode.SESSION_NOT_FOUND,
        'Interview session not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (session.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to view this session',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.mapToSessionDto(session);
  }

  async getSessionStatus(userId: string, userRole: UserRole, sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        turns: {
          orderBy: { turnNumber: 'asc' },
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
      throw new DomainException(
        ErrorCode.SESSION_NOT_FOUND,
        'Interview session not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (session.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to view this session',
        HttpStatus.FORBIDDEN,
      );
    }

    const currentTurn = session.turns.find(t => t.turnNumber === session.currentTurn);

    return {
      id: session.id,
      state: session.state,
      currentTurn: session.currentTurn,
      totalTurns: session.totalTurns,
      latestTurn: currentTurn ? this.mapToTurnDto(currentTurn) : null,
      overallScore: session.overallScore,
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  async submitAnswer(userId: string, sessionId: string, dto: SubmitAnswerRequestDto) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        turns: {
          where: { id: dto.turnId },
          include: { question: true, answer: true },
        },
      },
    });

    if (!session) {
      throw new DomainException(
        ErrorCode.SESSION_NOT_FOUND,
        'Interview session not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (session.userId !== userId) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to submit answers for this session',
        HttpStatus.FORBIDDEN,
      );
    }

    // Validate state machine: must be ACTIVE to accept answer submission
    SessionStateMachine.validateTransition(session.state as SessionState, SessionState.EVALUATING);

    const turn = session.turns[0];
    if (!turn) {
      throw new DomainException(ErrorCode.RESOURCE_NOT_FOUND, 'Turn not found in this session');
    }

    if (turn.turnNumber !== session.currentTurn) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        `Cannot submit answer for turn ${turn.turnNumber} when active turn is ${session.currentTurn}`,
      );
    }

    if (!turn.question) {
      throw new DomainException(
        ErrorCode.QUESTION_NOT_FOUND,
        'Cannot submit an answer before the question has been generated',
      );
    }

    if (turn.answer) {
      throw new DomainException(
        ErrorCode.ANSWER_ALREADY_ACCEPTED,
        'An answer has already been accepted for this question',
        HttpStatus.CONFLICT,
      );
    }

    // 1. PERSIST ANSWER TO DATABASE FIRST
    const answer = await this.prisma.$transaction(async tx => {
      const createdAnswer = await tx.answer.create({
        data: {
          turnId: turn.id,
          content: dto.answerText.trim(),
        },
      });

      await tx.interviewTurn.update({
        where: { id: turn.id },
        data: { status: 'ANSWER_SUBMITTED' },
      });

      await tx.interviewSession.update({
        where: { id: sessionId },
        data: { state: SessionState.EVALUATING },
      });

      return createdAnswer;
    });

    this.logger.log(
      `Answer ${answer.id} persisted for session ${sessionId} turn ${turn.turnNumber}. Enqueuing evaluation job...`,
    );

    // 2. ENQUEUE EVALUATION BULLMQ JOB
    const jobId = `eval-${sessionId}-turn-${turn.turnNumber}`;
    await this.evaluationQueue.add(
      JobName.EVALUATE_ANSWER,
      {
        sessionId,
        turnId: turn.id,
        turnNumber: turn.turnNumber,
        answerId: answer.id,
      },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    // 3. EMIT SSE EVENT
    this.sseService.emitSessionEvent(sessionId, SseEventType.SESSION_UPDATED, {
      sessionId,
      state: SessionState.EVALUATING,
      currentTurn: turn.turnNumber,
      answerSubmitted: true,
    });

    return {
      answerId: answer.id,
      turnId: turn.id,
      sessionId,
      status: 'EVALUATING',
      submittedAt: answer.submittedAt.toISOString(),
    };
  }

  private mapToSessionDto(session: any) {
    return {
      id: session.id,
      userId: session.userId,
      state: session.state,
      currentTurn: session.currentTurn,
      totalTurns: session.totalTurns,
      targetDifficulty: session.targetDifficulty as DifficultyLevel,
      overallScore: session.overallScore,
      jobRole: {
        id: session.jobRole.id,
        slug: session.jobRole.slug,
        name: session.jobRole.name,
        description: session.jobRole.description,
        isActive: session.jobRole.isActive,
      },
      seniorityLevel: {
        id: session.seniorityLevel.id,
        slug: session.seniorityLevel.slug,
        name: session.seniorityLevel.name,
        order: session.seniorityLevel.order,
        description: session.seniorityLevel.description,
        isActive: session.seniorityLevel.isActive,
      },
      technologies: (session.technologies || []).map((st: any) => ({
        id: st.technology ? st.technology.id : st.id,
        slug: st.technology ? st.technology.slug : st.slug,
        name: st.technology ? st.technology.name : st.name,
        category: st.technology ? st.technology.category : st.category,
        isActive: st.technology ? st.technology.isActive : st.isActive,
      })),
      turns: (session.turns || []).map((t: any) => this.mapToTurnDto(t)),
      learningPath: session.learningPath
        ? {
            id: session.learningPath.id,
            sessionId: session.learningPath.sessionId,
            status: session.learningPath.status,
            summary: session.learningPath.summary,
            errorMessage: session.learningPath.errorMessage,
            items: (session.learningPath.items || []).map((item: any) => ({
              id: item.id,
              gap: item.gap,
              topic: item.topic,
              priority: item.priority,
              recommendedAction: item.recommendedAction,
              searchKeywords: item.searchKeywords || [],
              order: item.order,
            })),
            createdAt: session.learningPath.createdAt.toISOString(),
            updatedAt: session.learningPath.updatedAt.toISOString(),
          }
        : null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  private mapToTurnDto(turn: any) {
    return {
      id: turn.id,
      sessionId: turn.sessionId,
      turnNumber: turn.turnNumber,
      difficulty: turn.difficulty as DifficultyLevel,
      status: turn.status,
      question: turn.question
        ? {
            id: turn.question.id,
            turnId: turn.question.turnId,
            content: turn.question.content,
            difficulty: turn.question.difficulty as DifficultyLevel,
            keyFocus: turn.question.keyFocus,
            createdAt: turn.question.createdAt.toISOString(),
          }
        : null,
      answer: turn.answer
        ? {
            id: turn.answer.id,
            turnId: turn.answer.turnId,
            content: turn.answer.content,
            submittedAt: turn.answer.submittedAt.toISOString(),
            evaluation: turn.answer.evaluation
              ? {
                  id: turn.answer.evaluation.id,
                  answerId: turn.answer.evaluation.answerId,
                  score: turn.answer.evaluation.score,
                  rubricScores: turn.answer.evaluation.rubricScores,
                  strengths: turn.answer.evaluation.strengths,
                  improvements: turn.answer.evaluation.improvements,
                  conciseFeedback: turn.answer.evaluation.conciseFeedback,
                  evidence: turn.answer.evaluation.evidence,
                  createdAt: turn.answer.evaluation.createdAt.toISOString(),
                }
              : null,
          }
        : null,
      createdAt: turn.createdAt.toISOString(),
      updatedAt: turn.updatedAt.toISOString(),
    };
  }
}
