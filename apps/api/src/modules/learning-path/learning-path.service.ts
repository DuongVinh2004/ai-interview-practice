import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import {
  QueueName,
  JobName,
  LearningPathStatus,
  ErrorCode,
  UserRole,
  SessionState,
} from '@ai-interview/contracts';

@Injectable()
export class LearningPathService {
  private readonly logger = new Logger(LearningPathService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QueueName.LEARNING_PATH)
    private readonly learningPathQueue: Queue,
  ) {}

  async getLearningPath(userId: string, userRole: UserRole, sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
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
        'You do not have permission to view this learning path',
        HttpStatus.FORBIDDEN,
      );
    }

    const learningPath = await this.prisma.learningPath.findUnique({
      where: { sessionId },
      include: {
        items: { orderBy: { order: 'asc' } },
      },
    });

    if (!learningPath) {
      return {
        sessionId,
        status: LearningPathStatus.PENDING,
        items: [],
      };
    }

    return learningPath;
  }

  async regenerateLearningPath(userId: string, sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
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
        'You do not have permission to regenerate this learning path',
        HttpStatus.FORBIDDEN,
      );
    }

    if (session.state !== SessionState.COMPLETED) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Learning paths can only be generated for completed interviews',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Set status to PENDING
    await this.prisma.learningPath.upsert({
      where: { sessionId },
      update: {
        status: LearningPathStatus.PENDING,
        errorMessage: null,
      },
      create: {
        sessionId,
        status: LearningPathStatus.PENDING,
      },
    });

    const jobId = `lp-regen-${sessionId}-${Date.now()}`;
    await this.learningPathQueue.add(
      JobName.GENERATE_LEARNING_PATH,
      { sessionId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    this.logger.log(`Learning path regeneration enqueued for session ${sessionId} (Job: ${jobId})`);

    return {
      sessionId,
      status: LearningPathStatus.PENDING,
      message: 'Learning path regeneration initiated',
    };
  }
}
