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
  AuditAction,
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

  /**
   * Toggles the completion status of a specific learning recommendation item
   */
  async updateItemStatus(userId: string, sessionId: string, itemId: string, isCompleted: boolean) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { learningPath: true },
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
        'You do not own this interview session',
        HttpStatus.FORBIDDEN,
      );
    }

    const item = await this.prisma.learningPathItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.learningPathId !== session.learningPath?.id) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Learning path item not found in this session',
        HttpStatus.NOT_FOUND,
      );
    }

    const updatedItem = await this.prisma.learningPathItem.update({
      where: { id: itemId },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.LEARNING_GOAL_TOGGLED,
        resource: 'learning_path_item',
        resourceId: itemId,
        details: {
          sessionId,
          itemId,
          topic: item.topic,
          isCompleted,
        },
      },
    });

    return {
      id: updatedItem.id,
      gap: updatedItem.gap,
      topic: updatedItem.topic,
      priority: updatedItem.priority,
      recommendedAction: updatedItem.recommendedAction,
      searchKeywords: updatedItem.searchKeywords || [],
      order: updatedItem.order,
      isCompleted: updatedItem.isCompleted,
      completedAt: updatedItem.completedAt ? updatedItem.completedAt.toISOString() : null,
    };
  }

  /**
   * Aggregates all learning goals across the user's sessions
   */
  async getMyLearningGoals(userId: string) {
    const learningPaths = await this.prisma.learningPath.findMany({
      where: {
        session: { userId },
      },
      include: {
        session: {
          select: {
            id: true,
            jobRole: { select: { name: true } },
            seniorityLevel: { select: { name: true } },
            completedAt: true,
          },
        },
        items: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const allItems: any[] = [];
    let completedCount = 0;

    for (const lp of learningPaths) {
      for (const item of lp.items) {
        if (item.isCompleted) completedCount++;
        allItems.push({
          id: item.id,
          sessionId: lp.sessionId,
          roleName: lp.session.jobRole.name,
          levelName: lp.session.seniorityLevel.name,
          gap: item.gap,
          topic: item.topic,
          priority: item.priority,
          recommendedAction: item.recommendedAction,
          searchKeywords: item.searchKeywords || [],
          isCompleted: item.isCompleted,
          completedAt: item.completedAt ? item.completedAt.toISOString() : null,
          createdAt: lp.createdAt.toISOString(),
        });
      }
    }

    return {
      totalGoals: allItems.length,
      completedGoals: completedCount,
      completionRate:
        allItems.length > 0 ? Math.round((completedCount / allItems.length) * 100) : 0,
      goals: allItems,
    };
  }
}
