import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
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
  AuditAction,
  SessionMode,
  CompetencyArea,
  BillingMetric,
} from '@ai-interview/contracts';
import { AiOrchestratorService } from '../ai-orchestrator/ai-orchestrator.service';
import {
  CreateInterviewRequestDto,
  SubmitAnswerRequestDto,
  ReEvaluateTurnRequestDto,
} from './dto/interview.dto';
import { UsageMeterService } from '../billing/usage-meter.service';
import { InterviewConfigurationService } from '../interview-configuration/interview-configuration.service';

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: SseService,
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly usageMeter: UsageMeterService,
    private readonly configService: InterviewConfigurationService,
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

    const totalTurns =
      dto.totalTurns && dto.totalTurns >= 1 && dto.totalTurns <= 5 ? dto.totalTurns : 5;
    const sessionMode = dto.sessionMode || SessionMode.STANDARD;
    const isSandbox = dto.isSandbox || false;
    const competencyArea = dto.competencyArea || null;

    const turnIndices = Array.from({ length: totalTurns }, (_, i) => i + 1);

    // Create session, technologies join, and turn rows with bounded retry on serialization conflict (P2034)
    const MAX_RETRIES = 3;
    let session: any;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        session = await this.prisma.$transaction(
          async tx => {
            await this.usageMeter.checkAndConsumeQuotaInTransaction(
              tx,
              userId,
              BillingMetric.SESSION_COUNT,
            );

            const configurationSnapshot = await this.configService.buildConfigurationSnapshot(
              {
                jobRoleId: dto.jobRoleId,
                seniorityLevelId: dto.seniorityLevelId,
                technologyIds: dto.technologyIds,
                sessionMode,
                competencyArea: competencyArea || undefined,
                language: dto.language || 'vi',
                totalTurns,
                isSandbox,
                blueprintId: dto.blueprintId || undefined,
              },
              tx,
            );

            return tx.interviewSession.create({
              data: {
                userId,
                jobRoleId: dto.jobRoleId,
                seniorityLevelId: dto.seniorityLevelId,
                state: SessionState.CREATED,
                sessionMode,
                competencyArea,
                language: dto.language || 'vi',
                isSandbox,
                currentTurn: 1,
                totalTurns,
                targetDifficulty: 1,
                configurationSnapshot,
                configurationSource:
                  dto.configurationSource || (dto.presetId ? 'PRESET' : 'MANUAL'),
                fieldSources: dto.fieldSources ? (dto.fieldSources as any) : undefined,
                draftId: dto.draftId || null,
                presetId: dto.presetId || null,
                technologies: {
                  create: dto.technologyIds.map(techId => ({
                    technologyId: techId,
                  })),
                },
                turns: {
                  create: turnIndices.map(turnNum => ({
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
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 },
        );
        break;
      } catch (err: any) {
        lastError = err;
        if (err?.code === 'P2034' && attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 25 * attempt));
          continue;
        }
        throw err;
      }
    }

    if (!session) {
      throw (
        lastError ||
        new DomainException(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to create session')
      );
    }

    const firstTurn = (session as any).turns?.find((t: any) => t.turnNumber === 1);
    if (!firstTurn) {
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Failed to initialize interview turns',
      );
    }

    // Enqueue generation of 1st question with deterministic job ID
    const jobId = `question-${session.id}-turn-1`;
    try {
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
    } catch (queueErr: any) {
      this.logger.error(`Failed to enqueue question generation: ${queueErr.message}`);
      await this.prisma.interviewSession.update({
        where: { id: session.id },
        data: { state: SessionState.FAILED },
      });
      if (this.usageMeter?.refundQuota) {
        await this.usageMeter.refundQuota(userId, BillingMetric.SESSION_COUNT, 1);
      }
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Failed to enqueue interview question generation. Quota has been refunded. Please try again.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (dto.blueprintId) {
      // H-011: enforce blueprint ownership before linking
      await this.prisma.interviewBlueprint
        .updateMany({
          where: {
            id: dto.blueprintId,
            OR: [{ jdAnalysis: { userId } }, { parsedProfile: { document: { userId } } }],
          },
          data: { interviewId: session.id },
        })
        .catch(err => {
          this.logger.warn(`Could not link blueprint ${dto.blueprintId}: ${err.message}`);
        });
    }

    this.logger.log(
      `Session ${session.id} created. Question 1 generation enqueued (Job: ${jobId})`,
    );

    this.sseService.emitSessionEvent(session.id, SseEventType.SESSION_UPDATED, {
      sessionId: session.id,
      state: session.state,
      currentTurn: 1,
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action:
          sessionMode === SessionMode.FOCUSED_REMEDIATION
            ? AuditAction.REMEDIATION_SESSION_STARTED
            : AuditAction.SESSION_CREATED,
        resource: 'interview_session',
        resourceId: session.id,
        details: {
          sessionMode,
          competencyArea,
          totalTurns,
          isSandbox,
        },
      },
    });

    // Record recent configuration asynchronously
    await this.configService
      .recordRecentConfiguration(
        userId,
        {
          jobRoleId: dto.jobRoleId,
          seniorityLevelId: dto.seniorityLevelId,
          technologyIds: dto.technologyIds,
          sessionMode,
          competencyArea: competencyArea || undefined,
          language: dto.language || 'vi',
          totalTurns,
          isSandbox,
          blueprintId: dto.blueprintId || undefined,
        },
        dto.presetId,
      )
      .catch((err: any) => {
        this.logger.warn(
          `Could not record recent configuration for session ${session.id}: ${err.message}`,
        );
      });

    if (dto.draftId) {
      await this.prisma.interviewSetupDraft
        .updateMany({
          where: { id: dto.draftId, userId },
          data: { status: 'COMPLETED' },
        })
        .catch((err: any) => {
          this.logger.warn(`Could not complete draft ${dto.draftId}: ${err.message}`);
        });
    }

    return this.mapToSessionDto(session);
  }

  async getSession(userId: string, userRole: UserRole, sessionId: string, mfaVerified?: boolean) {
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

    const isSuperAdmin = userRole === UserRole.ADMIN && mfaVerified === true;
    if (session.userId !== userId && !isSuperAdmin) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to view this session',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.mapToSessionDto(session);
  }

  async assertSessionAccess(
    userId: string,
    userRole: UserRole,
    sessionId: string,
    mfaVerified?: boolean,
  ): Promise<void> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });

    if (!session) {
      throw new DomainException(
        ErrorCode.SESSION_NOT_FOUND,
        'Interview session not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const isSuperAdmin = userRole === UserRole.ADMIN && mfaVerified === true;
    if (session.userId !== userId && !isSuperAdmin) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to access this session',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async getSessionStatus(
    userId: string,
    userRole: UserRole,
    sessionId: string,
    mfaVerified?: boolean,
  ) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        turns: {
          select: {
            turnNumber: true,
            status: true,
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

    const isSuperAdmin = userRole === UserRole.ADMIN && mfaVerified === true;
    if (session.userId !== userId && !isSuperAdmin) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to view this session',
        HttpStatus.FORBIDDEN,
      );
    }

    const currentTurn = session.turns.find(t => t.turnNumber === session.currentTurn);

    return {
      id: session.id,
      state: session.state as unknown as SessionState,
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

    // 1. PERSIST ANSWER TO DATABASE FIRST WITH CAS STATE TRANSITION
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

      const sessionUpdate = await tx.interviewSession.updateMany({
        where: { id: sessionId, state: SessionState.ACTIVE },
        data: { state: SessionState.EVALUATING },
      });

      if (sessionUpdate.count === 0) {
        throw new DomainException(
          ErrorCode.INVALID_STATE_TRANSITION,
          'Interview session is no longer in ACTIVE state (concurrent state modification)',
          HttpStatus.CONFLICT,
        );
      }

      return createdAnswer;
    });

    this.logger.log(
      `Answer ${answer.id} persisted for session ${sessionId} turn ${turn.turnNumber}. Enqueuing evaluation job...`,
    );

    // 2. ENQUEUE EVALUATION BULLMQ JOB
    const jobId = `eval-${sessionId}-turn-${turn.turnNumber}`;
    try {
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
    } catch (queueErr: any) {
      this.logger.error(
        `Failed to enqueue evaluation job: ${queueErr.message}. Preserving the committed answer for durable reconciliation.`,
      );
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Evaluation queue is temporarily unavailable. Your answer was saved and will be retried automatically.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

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

  async reEvaluateTurn(
    userId: string,
    userRole: UserRole,
    sessionId: string,
    turnNumber: number,
    dto?: ReEvaluateTurnRequestDto,
    mfaVerified?: boolean,
  ) {
    await this.assertSessionAccess(userId, userRole, sessionId, mfaVerified);

    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        turns: {
          where: { turnNumber },
          include: {
            question: true,
            answer: {
              include: {
                evaluation: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new DomainException(ErrorCode.SESSION_NOT_FOUND, 'Interview session not found');
    }

    const turn = session.turns[0];
    if (!turn || !turn.question || !turn.answer || !turn.answer.evaluation) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Turn ${turnNumber} is not in an evaluated state or has no answer to re-evaluate`,
      );
    }

    const oldScore = turn.answer.evaluation.score;
    let overallScore = session.overallScore;

    const isReviewerAdmin = userRole === UserRole.ADMIN && mfaVerified === true;
    const existingEval = this.prisma.evaluation?.findUnique
      ? await this.prisma.evaluation.findUnique({
          where: { answerId: turn.answer.id },
        })
      : this.prisma.evaluation?.findFirst
        ? await this.prisma.evaluation.findFirst({ where: { answerId: turn.answer.id } })
        : null;

    const reservationId =
      !isReviewerAdmin && existingEval
        ? await this.reserveCandidateReevaluation(existingEval.id, userId)
        : undefined;

    // Invoke AI Orchestrator to evaluate answer
    let evalResult: any;
    try {
      evalResult = await this.aiOrchestrator.evaluateAnswer(sessionId, {
        role: session.jobRole.name,
        level: session.seniorityLevel.name,
        question: turn.question.content,
        keyFocus: turn.question.keyFocus || undefined,
        expectedPoints: (turn.question.expectedPoints as string[]) || undefined,
        answer: turn.answer.content,
      });
    } catch (error) {
      if (reservationId) {
        await (this.prisma as any).evaluationRunReservation.updateMany({
          where: { id: reservationId, status: 'PENDING' },
          data: { status: 'FAILED' },
        });
      }
      throw error;
    }

    const evalRecord: any =
      existingEval ||
      (this.prisma.evaluation?.create
        ? await this.prisma.evaluation.create({
            data: {
              answerId: turn.answer.id,
              score: evalResult.score,
              rubricScores: evalResult.rubricScores as any,
              strengths: evalResult.strengths,
              improvements: evalResult.improvements,
              conciseFeedback: evalResult.conciseFeedback,
              evidence: evalResult.evidence,
            },
          })
        : { id: turn.answer.id, answerId: turn.answer.id, score: evalResult.score });

    const triggeredBy = isReviewerAdmin ? 'REVIEWER' : 'CANDIDATE';
    const isAuthoritativeReview =
      isReviewerAdmin &&
      !evalResult.needsReview &&
      Boolean((evalResult as any).provider) &&
      ['gemini', 'openai', 'anthropic'].includes(
        String((evalResult as any).provider).toLowerCase(),
      ) &&
      evalResult.evidence.length > 0;
    const authorityState = isAuthoritativeReview ? 'AUTHORITATIVE' : 'NEEDS_REVIEW';

    const run = (this.prisma as any).evaluationRun?.create
      ? await this.createEvaluationRun(
          evalRecord.id,
          {
            score: evalResult.score,
            rubricScores: evalResult.rubricScores as any,
            strengths: evalResult.strengths,
            improvements: evalResult.improvements,
            conciseFeedback: evalResult.conciseFeedback,
            evidence: evalResult.evidence,
            needsReview: !isAuthoritativeReview,
            authorityState,
            provider: (evalResult as any).provider || undefined,
            fallbackReason: (evalResult as any).fallbackReason || undefined,
            confidence: evalResult.confidence || 0.85,
            triggeredBy,
          },
          reservationId,
        )
      : null;

    // Only authorized reviewer/admin can overwrite canonical projection score
    let updatedEval: any = evalRecord;
    if (isAuthoritativeReview) {
      updatedEval = await this.prisma.evaluation.update({
        where: { answerId: turn.answer.id },
        data: {
          score: evalResult.score,
          rubricScores: evalResult.rubricScores as any,
          strengths: evalResult.strengths,
          improvements: evalResult.improvements,
          conciseFeedback: evalResult.conciseFeedback,
          evidence: evalResult.evidence,
          needsReview: false,
          authorityState: 'AUTHORITATIVE',
          provider: (evalResult as any).provider || undefined,
          fallbackReason: (evalResult as any).fallbackReason || undefined,
          confidence: evalResult.confidence || 0.85,
          ...(run ? { currentRunId: run.id } : {}),
        },
      });
    }

    // Recalculate overall score across completed evaluations
    const allEvaluations = await this.prisma.evaluation.findMany({
      where: {
        answer: { turn: { sessionId } },
        authorityState: 'AUTHORITATIVE',
        needsReview: false,
      },
    });

    overallScore =
      allEvaluations.length > 0
        ? Number(
            (allEvaluations.reduce((sum, e) => sum + e.score, 0) / allEvaluations.length).toFixed(
              1,
            ),
          )
        : null;

    if (isAuthoritativeReview && overallScore !== null) {
      await this.prisma.interviewSession.update({
        where: { id: sessionId },
        data: { overallScore },
      });
    }

    // Emit SSE event
    this.sseService.emitSessionEvent(sessionId, SseEventType.EVALUATION_COMPLETED, {
      sessionId,
      turnNumber,
      evaluation: {
        id: updatedEval.id,
        score: isReviewerAdmin ? updatedEval.score : evalResult.score,
        rubricScores: isReviewerAdmin ? updatedEval.rubricScores : evalResult.rubricScores,
        conciseFeedback: isReviewerAdmin ? updatedEval.conciseFeedback : evalResult.conciseFeedback,
      },
      overallScore,
    });

    // Audit log re-evaluation
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.EVALUATION_RE_EVALUATED,
        resource: 'evaluation',
        resourceId: updatedEval.id,
        details: {
          sessionId,
          turnNumber,
          oldScore,
          newScore: isReviewerAdmin ? updatedEval.score : evalResult.score,
          reason: dto?.reason,
        },
      },
    });

    this.logger.log(
      `Turn ${turnNumber} of session ${sessionId} re-evaluated by user ${userId}. Score: ${isReviewerAdmin ? updatedEval.score : evalResult.score}`,
    );

    return {
      id: updatedEval.id,
      answerId: updatedEval.answerId || turn.answer.id,
      score: isReviewerAdmin ? updatedEval.score : evalResult.score,
      rubricScores: isReviewerAdmin ? updatedEval.rubricScores : evalResult.rubricScores,
      strengths: isReviewerAdmin ? updatedEval.strengths : evalResult.strengths,
      improvements: isReviewerAdmin ? updatedEval.improvements : evalResult.improvements,
      conciseFeedback: isReviewerAdmin ? updatedEval.conciseFeedback : evalResult.conciseFeedback,
      evidence: isReviewerAdmin ? updatedEval.evidence : evalResult.evidence,
      overallScore,
      createdAt: (updatedEval.createdAt || new Date()).toISOString(),
    };
  }

  private async reserveCandidateReevaluation(
    evaluationId: string,
    actorUserId: string,
  ): Promise<string> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async tx => {
            const reservations = (tx as any).evaluationRunReservation;
            const now = new Date();
            await reservations.updateMany({
              where: { evaluationId, status: 'PENDING', expiresAt: { lte: now } },
              data: { status: 'EXPIRED' },
            });

            const [completedRuns, pendingReservations] = await Promise.all([
              tx.evaluationRun.count({
                where: { evaluationId, triggeredBy: 'CANDIDATE' },
              }),
              reservations.count({
                where: {
                  evaluationId,
                  triggeredBy: 'CANDIDATE',
                  status: 'PENDING',
                  expiresAt: { gt: now },
                },
              }),
            ]);
            if (completedRuns + pendingReservations >= 2) {
              throw new DomainException(
                ErrorCode.QUOTA_EXCEEDED,
                'Maximum re-evaluation attempts (2) reached for this turn',
                HttpStatus.TOO_MANY_REQUESTS,
              );
            }

            const reservation = await reservations.create({
              data: {
                evaluationId,
                actorUserId,
                triggeredBy: 'CANDIDATE',
                status: 'PENDING',
                expiresAt: new Date(now.getTime() + 5 * 60_000),
              },
            });
            return reservation.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: any) {
        if (error instanceof DomainException) throw error;
        if (error?.code === 'P2034' && attempt < 3) continue;
        if (error?.code === 'P2034') {
          throw new DomainException(
            ErrorCode.INVALID_STATE_TRANSITION,
            'A re-evaluation attempt is already being reserved. Please retry.',
            HttpStatus.CONFLICT,
          );
        }
        throw error;
      }
    }
    throw new DomainException(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Unable to reserve a re-evaluation attempt',
    );
  }

  private async createEvaluationRun(
    evaluationId: string,
    data: Record<string, unknown>,
    reservationId?: string,
  ): Promise<any> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async tx => {
            const lastRun = await tx.evaluationRun.findFirst({
              where: { evaluationId },
              orderBy: { runNumber: 'desc' },
            });
            const run = await tx.evaluationRun.create({
              data: {
                evaluationId,
                runNumber: (lastRun?.runNumber || 0) + 1,
                ...data,
              } as any,
            });
            if (reservationId) {
              await (tx as any).evaluationRunReservation.updateMany({
                where: { id: reservationId, status: 'PENDING' },
                data: { status: 'COMPLETED' },
              });
            }
            return run;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: any) {
        if ((error?.code === 'P2034' || error?.code === 'P2002') && attempt < 3) continue;
        throw error;
      }
    }
    throw new DomainException(ErrorCode.INTERNAL_SERVER_ERROR, 'Unable to persist evaluation run');
  }

  private mapToSessionDto(session: any) {
    return {
      id: session.id,
      userId: session.userId,
      state: session.state,
      sessionMode: session.sessionMode,
      competencyArea: session.competencyArea,
      isSandbox: session.isSandbox,
      currentTurn: session.currentTurn,
      totalTurns: session.totalTurns,
      targetDifficulty: session.targetDifficulty as DifficultyLevel,
      overallScore: session.overallScore,
      configurationSnapshot: session.configurationSnapshot || null,
      configurationSource: session.configurationSource || 'MANUAL',
      fieldSources: session.fieldSources || null,
      presetId: session.presetId || null,
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
              isCompleted: item.isCompleted || false,
              completedAt: item.completedAt ? item.completedAt.toISOString() : null,
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
      isFollowUp: turn.isFollowUp || false,
      parentTurnNumber: turn.parentTurnNumber || null,
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
