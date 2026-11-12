import { Injectable, Logger, HttpException, HttpStatus, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../platform/prisma/prisma.service';

export interface RecordVisionRunParams {
  provider: string;
  model: string;
  costEstimate: number;
  latencyMs?: number;
  sessionId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class VisionBudgetService {
  private readonly logger = new Logger(VisionBudgetService.name);
  private readonly dailyBudgetUsd: number;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    const rawBudget =
      this.configService?.get<number>('vision.dailyBudgetUsd') ??
      this.configService?.get<number>('VISION_DAILY_BUDGET_USD') ??
      (process.env.VISION_DAILY_BUDGET_USD
        ? Number(process.env.VISION_DAILY_BUDGET_USD)
        : undefined);

    this.dailyBudgetUsd = typeof rawBudget === 'number' && !isNaN(rawBudget) ? rawBudget : 5.0;
  }

  getDailyBudgetUsd(): number {
    return this.dailyBudgetUsd;
  }

  async getTodayVisionCostUsd(): Promise<number> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const runs = await this.prisma.aiRun.findMany({
      where: {
        createdAt: { gte: todayStart },
        status: 'SUCCESS',
      },
      select: {
        costEstimate: true,
        metadata: true,
      },
    });

    const visionRuns = runs.filter((run: { costEstimate: number | null; metadata: any }) => {
      const meta = run.metadata as Record<string, any> | null;
      return meta?.type === 'VISION' || (run as any).type === 'VISION';
    });

    return visionRuns.reduce(
      (sum: number, run: { costEstimate: number | null }) => sum + (run.costEstimate || 0),
      0,
    );
  }

  async checkBudget(estimatedCost = 0): Promise<boolean> {
    const todayCost = await this.getTodayVisionCostUsd();
    if (todayCost + estimatedCost > this.dailyBudgetUsd) {
      this.logger.warn(
        `Vision daily budget exhausted: current $${todayCost.toFixed(4)}, estimated $${estimatedCost.toFixed(4)}, budget $${this.dailyBudgetUsd.toFixed(2)}`,
      );
      throw new HttpException(
        'Vision API daily budget exceeded. Please try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  async recordVisionRun(params: RecordVisionRunParams): Promise<any> {
    return await this.prisma.aiRun.create({
      data: {
        sessionId: params.sessionId || null,
        provider: params.provider,
        model: params.model,
        promptTokens: params.promptTokens || null,
        completionTokens: params.completionTokens || null,
        totalTokens: params.totalTokens || null,
        latencyMs: params.latencyMs || 0,
        costEstimate: params.costEstimate,
        status: 'SUCCESS',
        metadata: {
          type: 'VISION',
          ...(params.metadata || {}),
        },
      },
    });
  }
}
