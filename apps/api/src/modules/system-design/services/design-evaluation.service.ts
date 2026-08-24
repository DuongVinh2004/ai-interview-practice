import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { MockVisionProvider } from '../providers/mock-vision.provider';
import { DesignEvaluationDto } from '@ai-interview/contracts';

@Injectable()
export class DesignEvaluationService {
  private readonly logger = new Logger(DesignEvaluationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visionProvider: MockVisionProvider
  ) {}

  /**
   * Evaluate full system design whiteboard session
   */
  async evaluateSession(interviewId: string): Promise<DesignEvaluationDto> {
    const session = await this.prisma.systemDesignSession.findUnique({
      where: { interviewId },
      include: {
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`System design session for interview ${interviewId} not found`);
    }

    const latestSnapshot = session.snapshots[0];
    const analysis = await this.visionProvider.analyzeCanvasDiagram({
      imageUrl: latestSnapshot?.imageUrl || 'data:image/png;base64,mock',
      canvasStateJson: latestSnapshot?.canvasStateJson,
      problemPrompt: session.initialPrompt || undefined,
    });

    const rubric = analysis.rubricScores;
    // 5-axis weighted sum:
    // Requirements (15%), High-Level (25%), Component Detail (20%), Scalability (20%), Data Model (20%)
    const overallScore = Number(
      (
        rubric.requirements * 0.15 +
        rubric.highLevel * 0.25 +
        rubric.componentDetail * 0.2 +
        rubric.scalability * 0.2 +
        rubric.dataModel * 0.2
      ).toFixed(1)
    );

    const feedback = `${analysis.summary}\n\nKey Strengths:\n- ${analysis.strengths.join('\n- ')}\n\nBottlenecks to Address:\n- ${analysis.potentialBottlenecks.join('\n- ')}`;

    const evalRecord = await this.prisma.designEvaluation.upsert({
      where: { sessionId: session.id },
      update: {
        requirementsScore: rubric.requirements,
        highLevelScore: rubric.highLevel,
        componentDetailScore: rubric.componentDetail,
        scalabilityScore: rubric.scalability,
        dataModelScore: rubric.dataModel,
        overallScore,
        feedback,
      },
      create: {
        sessionId: session.id,
        requirementsScore: rubric.requirements,
        highLevelScore: rubric.highLevel,
        componentDetailScore: rubric.componentDetail,
        scalabilityScore: rubric.scalability,
        dataModelScore: rubric.dataModel,
        overallScore,
        feedback,
      },
    });

    return {
      id: evalRecord.id,
      sessionId: evalRecord.sessionId,
      requirementsScore: evalRecord.requirementsScore,
      highLevelScore: evalRecord.highLevelScore,
      componentDetailScore: evalRecord.componentDetailScore,
      scalabilityScore: evalRecord.scalabilityScore,
      dataModelScore: evalRecord.dataModelScore,
      overallScore: evalRecord.overallScore,
      feedback: evalRecord.feedback,
      rubricBreakdown: {
        requirements: `Scope defined with clear non-functional limits: ${rubric.requirements}/10`,
        highLevel: `Well-structured microservices boundary: ${rubric.highLevel}/10`,
        componentDetail: `Accurate message queue and cache positioning: ${rubric.componentDetail}/10`,
        scalability: `Horizontal scaling and failover strategy: ${rubric.scalability}/10`,
        dataModel: `Storage sharding and partitioning choices: ${rubric.dataModel}/10`,
      },
      detectedComponents: analysis.detectedComponents,
      strengths: analysis.strengths,
      bottlenecks: analysis.potentialBottlenecks,
      recommendations: analysis.realtimeSuggestions,
      createdAt: evalRecord.createdAt.toISOString(),
    };
  }
}
