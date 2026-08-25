import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { MockVisionProvider } from '../providers/mock-vision.provider';
import { VisionAnalysisResultDto } from '@ai-interview/contracts';

@Injectable()
export class DesignAnalyzerService {
  private readonly logger = new Logger(DesignAnalyzerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visionProvider: MockVisionProvider
  ) {}

  /**
   * Analyze latest canvas snapshot
   */
  async analyzeSnapshot(
    userId: string,
    interviewId: string,
    imageUrl?: string,
    canvasStateJson?: any
  ): Promise<VisionAnalysisResultDto> {
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

    const targetImageUrl = imageUrl || session?.snapshots[0]?.imageUrl || 'data:image/png;base64,mock';
    const targetState = canvasStateJson || session?.snapshots[0]?.canvasStateJson;

    const analysis = await this.visionProvider.analyzeCanvasDiagram({
      imageUrl: targetImageUrl,
      canvasStateJson: targetState,
      problemPrompt: session?.initialPrompt || undefined,
    });

    // If snapshot exists, update with AI analysis result
    if (session?.snapshots[0]) {
      await this.prisma.canvasSnapshot.update({
        where: { id: session.snapshots[0].id },
        data: { aiAnalysis: analysis as any },
      });
      analysis.snapshotId = session.snapshots[0].id;
    }

    return analysis;
  }
}
