import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { SseService } from '../platform/sse/sse.service';
import { AiOrchestratorService } from '../ai-orchestrator/ai-orchestrator.service';
import { QueueName, JobName, LearningPathStatus, SseEventType } from '@ai-interview/contracts';

interface GenerateLearningPathJobData {
  sessionId: string;
}

@Processor(QueueName.LEARNING_PATH)
export class LearningPathProcessor extends WorkerHost {
  private readonly logger = new Logger(LearningPathProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: SseService,
    private readonly aiOrchestrator: AiOrchestratorService,
  ) {
    super();
  }

  async process(job: Job<GenerateLearningPathJobData, any, string>): Promise<any> {
    if (job.name !== JobName.GENERATE_LEARNING_PATH) {
      return;
    }

    const { sessionId } = job.data;
    this.logger.log(`Processing learning path for session ${sessionId} (Job ${job.id})`);

    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        turns: {
          orderBy: { turnNumber: 'asc' },
          include: {
            question: true,
            answer: { include: { evaluation: true } },
          },
        },
      },
    });

    if (!session) {
      this.logger.error(`Session ${sessionId} not found for learning path generation`);
      return;
    }

    const turnsSummary = session.turns.map(t => ({
      turnNumber: t.turnNumber,
      question: t.question?.content || '',
      answer: t.answer?.content || '',
      score: t.answer?.evaluation?.score || 0,
      strengths: (t.answer?.evaluation?.strengths as string[]) || [],
      improvements: (t.answer?.evaluation?.improvements as string[]) || [],
    }));

    try {
      const generatedLp = await this.aiOrchestrator.generateLearningPath(sessionId, {
        role: session.jobRole.name,
        level: session.seniorityLevel.name,
        turns: turnsSummary,
        overallScore: session.overallScore || 0,
        language: (session as any).language || 'vi',
      });

      const learningPath = await this.prisma.$transaction(async tx => {
        const lp = await tx.learningPath.upsert({
          where: { sessionId },
          update: {
            status: LearningPathStatus.READY,
            summary: generatedLp.summary,
            errorMessage: null,
          },
          create: {
            sessionId,
            status: LearningPathStatus.READY,
            summary: generatedLp.summary,
          },
        });

        // Clear existing items if regenerating
        await tx.learningPathItem.deleteMany({
          where: { learningPathId: lp.id },
        });

        // Insert new items
        await tx.learningPathItem.createMany({
          data: generatedLp.items.map((item, index) => ({
            learningPathId: lp.id,
            gap: item.gap,
            topic: item.topic,
            priority: item.priority,
            recommendedAction: item.recommendedAction,
            searchKeywords: item.searchKeywords,
            order: index,
          })),
        });

        return lp;
      });

      this.logger.log(`Learning path generated successfully for session ${sessionId}`);

      this.sseService.emitSessionEvent(sessionId, SseEventType.LEARNING_PATH_READY, {
        sessionId,
        learningPathId: learningPath.id,
        status: LearningPathStatus.READY,
        summary: generatedLp.summary,
        items: generatedLp.items,
      });

      return learningPath;
    } catch (error: any) {
      this.logger.error(
        `Failed to generate learning path for session ${sessionId}: ${error.message}`,
        error.stack,
      );
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        // Independent failure: mark learning path FAILED, session remains COMPLETED
        await this.prisma.learningPath.upsert({
          where: { sessionId },
          update: {
            status: LearningPathStatus.FAILED,
            errorMessage: error.message,
          },
          create: {
            sessionId,
            status: LearningPathStatus.FAILED,
            errorMessage: error.message,
          },
        });

        // Notify client via SSE of failure (NEW-ASYNC-02)
        this.sseService.emitSessionEvent(sessionId, SseEventType.LEARNING_PATH_FAILED, {
          sessionId,
          status: LearningPathStatus.FAILED,
          errorMessage: error.message,
        });
      }
      throw error;
    }
  }
}
