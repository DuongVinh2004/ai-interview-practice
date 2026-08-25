import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QuotaGuard, RequireQuota } from '../billing/guards/quota.guard';
import { BillingMetric } from '@ai-interview/contracts';
import { CanvasService } from './services/canvas.service';
import { DesignAnalyzerService } from './services/design-analyzer.service';
import { DesignEvaluationService } from './services/design-evaluation.service';
import { InitCanvasSessionDto, UploadCanvasSnapshotDto } from './dto/system-design.dto';

@ApiTags('System Design Interactive Whiteboard (F003)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews/:id/canvas')
export class SystemDesignController {
  constructor(
    private readonly canvasService: CanvasService,
    private readonly designAnalyzerService: DesignAnalyzerService,
    private readonly designEvaluationService: DesignEvaluationService,
  ) {}

  @Post('init')
  @ApiOperation({ summary: 'Initialize or load system design whiteboard session' })
  async initCanvas(
    @CurrentUser('sub') userId: string,
    @Param('id') interviewId: string,
    @Body() dto: InitCanvasSessionDto,
  ) {
    return this.canvasService.initSession(userId, interviewId, dto.initialPrompt);
  }

  @Post('snapshot')
  @ApiOperation({ summary: 'Upload and record canvas diagram snapshot' })
  async uploadSnapshot(
    @CurrentUser('sub') userId: string,
    @Param('id') interviewId: string,
    @Body() dto: UploadCanvasSnapshotDto,
  ) {
    return this.canvasService.saveSnapshot(
      userId,
      interviewId,
      dto.imageUrl,
      dto.canvasStateJson,
      dto.elapsedSeconds || 0,
    );
  }

  @Post('analyze')
  @UseGuards(JwtAuthGuard, QuotaGuard)
  @RequireQuota(BillingMetric.AI_TOKEN)
  @ApiOperation({ summary: 'Trigger multimodal AI vision analysis on canvas diagram' })
  async analyzeCanvas(
    @CurrentUser('sub') userId: string,
    @Param('id') interviewId: string,
    @Body() dto: Partial<UploadCanvasSnapshotDto>,
  ) {
    return this.designAnalyzerService.analyzeSnapshot(
      userId,
      interviewId,
      dto.imageUrl,
      dto.canvasStateJson,
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get all canvas snapshots for time-lapse playback' })
  async getSnapshotHistory(@CurrentUser('sub') userId: string, @Param('id') interviewId: string) {
    return this.canvasService.getSnapshotHistory(userId, interviewId);
  }

  @Post('evaluate')
  @ApiOperation({
    summary: 'Complete interview turn and evaluate design across 5 rubric dimensions',
  })
  async evaluateDesign(@CurrentUser('sub') userId: string, @Param('id') interviewId: string) {
    return this.designEvaluationService.evaluateSession(userId, interviewId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Get export metadata for system design canvas' })
  async exportCanvas(@CurrentUser('sub') userId: string, @Param('id') interviewId: string) {
    const session = await this.canvasService.getSession(userId, interviewId);
    return {
      interviewId,
      finalCanvasUrl: session.finalCanvasUrl,
      initialPrompt: session.initialPrompt,
      snapshotCount: session.snapshots?.length || 0,
      exportedAt: new Date().toISOString(),
    };
  }
}
