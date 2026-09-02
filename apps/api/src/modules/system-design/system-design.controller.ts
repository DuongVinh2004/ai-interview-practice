import { Controller, Get, Post, Body, Headers, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EvaluateDiagramDto } from '@ai-interview/contracts';
import { CanvasService } from './services/canvas.service';
import { DesignAnalyzerService } from './services/design-analyzer.service';
import { DesignEvaluationService } from './services/design-evaluation.service';
import {
  InitCanvasSessionDto,
  UploadCanvasSnapshotDto,
  ExportCanvasQueryDto,
} from './dto/system-design.dto';

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
  @ApiOperation({
    summary: 'Upload and record canvas diagram snapshot with optimistic concurrency check',
  })
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
      dto.expectedVersion,
      dto.ifMatchEtag,
    );
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Trigger multimodal AI vision analysis on canvas diagram' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async analyzeCanvas(
    @CurrentUser('sub') userId: string,
    @Param('id') interviewId: string,
    @Body() dto: Partial<UploadCanvasSnapshotDto>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.designAnalyzerService.analyzeSnapshot(
      userId,
      interviewId,
      dto.imageUrl,
      dto.canvasStateJson,
      idempotencyKey,
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
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async evaluateDesign(
    @CurrentUser('sub') userId: string,
    @Param('id') interviewId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.designEvaluationService.evaluateSession(userId, interviewId, idempotencyKey);
  }

  @Post('evaluate-diagram')
  @ApiOperation({
    summary: 'On-demand multimodal Vision AI evaluation with visual bounding box annotations',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async evaluateDiagram(
    @CurrentUser('sub') userId: string,
    @Param('id') interviewId: string,
    @Body() dto: EvaluateDiagramDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.designEvaluationService.evaluateDiagram(userId, interviewId, dto, idempotencyKey);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export system design canvas as SVG, PNG, or JSON metadata with ETag' })
  async exportCanvas(
    @CurrentUser('sub') userId: string,
    @Param('id') interviewId: string,
    @Query('format') format?: 'svg' | 'png' | 'json',
  ) {
    return this.canvasService.exportDiagram(userId, interviewId, format || 'svg');
  }
}
