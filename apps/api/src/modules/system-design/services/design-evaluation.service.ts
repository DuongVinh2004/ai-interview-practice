import { Injectable, Logger, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { VisionProvider } from '../interfaces/vision-provider.interface';
import {
  DesignEvaluationDto,
  EvaluateDiagramDto,
  DesignEvaluationResultDto,
} from '@ai-interview/contracts';
import { VisionEntitlementService } from './vision-entitlement.service';

@Injectable()
export class DesignEvaluationService {
  private readonly logger = new Logger(DesignEvaluationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('VISION_PROVIDER') private readonly visionProvider: VisionProvider,
    private readonly visionEntitlements: VisionEntitlementService,
  ) {}

  /**
   * Evaluate full system design whiteboard session
   */
  async evaluateSession(
    userId: string,
    interviewId: string,
    idempotencyKey?: string,
  ): Promise<DesignEvaluationDto> {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      throw new NotFoundException(`Interview session ${interviewId} not found`);
    }

    if (interview.userId !== userId) {
      throw new ForbiddenException('Access to this system design session is forbidden');
    }

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
    const visionResult = await this.visionEntitlements.evaluate({
      userId,
      idempotencyKey,
      operationType: 'system-design.evaluate',
      interviewId,
      provider: this.visionProvider,
      options: {
        imageBase64: latestSnapshot?.imageUrl || 'data:image/png;base64,mock',
        canvasData: latestSnapshot?.canvasStateJson,
        problemTitle: session.initialPrompt || undefined,
      },
    });

    const rubric = {
      requirements: visionResult.requirementsScore,
      highLevel: visionResult.highLevelScore,
      componentDetail: visionResult.componentDetailScore,
      scalability: visionResult.scalabilityScore,
      dataModel: visionResult.dataModelScore,
    };

    const overallScore = visionResult.overallScore;
    const feedback = `${visionResult.summary}\n\nKey Strengths:\n- ${visionResult.strengths.join('\n- ')}\n\nBottlenecks to Address:\n- ${visionResult.bottlenecks.join('\n- ')}`;

    const currentProvider = this.visionProvider.name || 'mock';
    const isMock = currentProvider.toLowerCase().includes('mock');
    const authorityState = isMock ? 'NON_AUTHORITATIVE' : 'AUTHORITATIVE';

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
        annotations: visionResult.annotations as any,
        authorityState,
        provider: currentProvider,
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
        annotations: visionResult.annotations as any,
        authorityState,
        provider: currentProvider,
      },
    });

    return {
      id: evalRecord.id,
      sessionId: evalRecord.sessionId,
      requirementsScore: evalRecord.requirementsScore ?? rubric.requirements,
      highLevelScore: evalRecord.highLevelScore ?? rubric.highLevel,
      componentDetailScore: evalRecord.componentDetailScore ?? rubric.componentDetail,
      scalabilityScore: evalRecord.scalabilityScore ?? rubric.scalability,
      dataModelScore: evalRecord.dataModelScore ?? rubric.dataModel,
      overallScore: evalRecord.overallScore,
      feedback: evalRecord.feedback ?? feedback,
      rubricBreakdown: {
        requirements: `Scope defined with clear non-functional limits: ${rubric.requirements}/10`,
        highLevel: `Well-structured microservices boundary: ${rubric.highLevel}/10`,
        componentDetail: `Accurate message queue and cache positioning: ${rubric.componentDetail}/10`,
        scalability: `Horizontal scaling and failover strategy: ${rubric.scalability}/10`,
        dataModel: `Storage sharding and partitioning choices: ${rubric.dataModel}/10`,
      },
      detectedComponents: visionResult.detectedComponents,
      strengths: visionResult.strengths,
      bottlenecks: visionResult.bottlenecks,
      recommendations: visionResult.recommendations,
      createdAt: evalRecord.createdAt.toISOString(),
    };
  }

  /**
   * Evaluate canvas snapshot diagram on-demand with multimodal AI Vision
   */
  async evaluateDiagram(
    userId: string,
    interviewId: string,
    dto: EvaluateDiagramDto,
    idempotencyKey?: string,
  ): Promise<DesignEvaluationResultDto> {
    const interview = await this.prisma.interviewSession.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      throw new NotFoundException(`Interview session ${interviewId} not found`);
    }

    if (interview.userId !== userId) {
      throw new ForbiddenException('Access to this system design session is forbidden');
    }

    const session = await this.prisma.systemDesignSession.findUnique({
      where: { interviewId },
    });

    if (!session) {
      throw new NotFoundException(`System design session for interview ${interviewId} not found`);
    }

    const visionResult = await this.visionEntitlements.evaluate({
      userId,
      idempotencyKey,
      operationType: 'system-design.evaluate-diagram',
      interviewId,
      provider: this.visionProvider,
      options: {
        imageBase64: dto.imageUrl,
        canvasData: dto.canvasData,
        problemTitle: session.initialPrompt || 'Distributed System Design',
        language: dto.language || 'vi',
      },
    });

    // Store input only after the paid provider operation has committed. This
    // prevents an exhausted quota from becoming a write-amplification vector.
    if (dto.imageUrl) {
      await this.prisma.canvasSnapshot.create({
        data: {
          sessionId: session.id,
          imageUrl: dto.imageUrl,
          imageAssetId: dto.fileAssetId || null,
          canvasStateJson: dto.canvasData || null,
          elapsedSeconds: 0,
        },
      });
    }

    const providerName = this.visionProvider.name || 'mock';
    const isMockProvider = providerName.toLowerCase().includes('mock');
    const diagAuthorityState = isMockProvider ? 'NON_AUTHORITATIVE' : 'AUTHORITATIVE';

    // Update DesignEvaluation record
    const evalRecord = await this.prisma.designEvaluation.upsert({
      where: { sessionId: session.id },
      update: {
        requirementsScore: visionResult.requirementsScore,
        highLevelScore: visionResult.highLevelScore,
        componentDetailScore: visionResult.componentDetailScore,
        scalabilityScore: visionResult.scalabilityScore,
        dataModelScore: visionResult.dataModelScore,
        overallScore: visionResult.overallScore,
        feedback: visionResult.feedback,
        annotations: visionResult.annotations as any,
        authorityState: diagAuthorityState,
        provider: providerName,
      },
      create: {
        sessionId: session.id,
        requirementsScore: visionResult.requirementsScore,
        highLevelScore: visionResult.highLevelScore,
        componentDetailScore: visionResult.componentDetailScore,
        scalabilityScore: visionResult.scalabilityScore,
        dataModelScore: visionResult.dataModelScore,
        overallScore: visionResult.overallScore,
        feedback: visionResult.feedback,
        annotations: visionResult.annotations as any,
        authorityState: diagAuthorityState,
        provider: providerName,
      },
    });

    return {
      id: evalRecord.id,
      sessionId: evalRecord.sessionId,
      overallScore: evalRecord.overallScore,
      requirementsScore: evalRecord.requirementsScore ?? visionResult.requirementsScore,
      highLevelScore: evalRecord.highLevelScore ?? visionResult.highLevelScore,
      componentDetailScore: evalRecord.componentDetailScore ?? visionResult.componentDetailScore,
      scalabilityScore: evalRecord.scalabilityScore ?? visionResult.scalabilityScore,
      dataModelScore: evalRecord.dataModelScore ?? visionResult.dataModelScore,
      summary: visionResult.summary,
      feedback: evalRecord.feedback ?? visionResult.feedback,
      detectedComponents: visionResult.detectedComponents,
      strengths: visionResult.strengths,
      bottlenecks: visionResult.bottlenecks,
      recommendations: visionResult.recommendations,
      annotations: visionResult.annotations,
      createdAt: evalRecord.createdAt.toISOString(),
    };
  }
}
