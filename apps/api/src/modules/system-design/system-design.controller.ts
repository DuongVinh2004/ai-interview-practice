import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
    private readonly designEvaluationService: DesignEvaluationService
  ) {}

  @Post('init')
  @ApiOperation({ summary: 'Initialize or load system design whiteboard session' })
  async initCanvas(
    @Param('id') interviewId: string,
    @Body() dto: InitCanvasSessionDto
  ) {
    return this.canvasService.initSession(interviewId, dto.initialPrompt);
  }

  @Post('snapshot')
  @ApiOperation({ summary: 'Upload and record canvas diagram snapshot' })
  async uploadSnapshot(
    @Param('id') interviewId: string,
    @Body() dto: UploadCanvasSnapshotDto
  ) {
    return this.canvasService.saveSnapshot(
      interviewId,
      dto.imageUrl,
      dto.canvasStateJson,
      dto.elapsedSeconds || 0
    );
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Trigger multimodal AI vision analysis on canvas diagram' })
  async analyzeCanvas(
    @Param('id') interviewId: string,
    @Body() dto: Partial<UploadCanvasSnapshotDto>
  ) {
    return this.designAnalyzerService.analyzeSnapshot(
      interviewId,
      dto.imageUrl,
      dto.canvasStateJson
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get all canvas snapshots for time-lapse playback' })
  async getSnapshotHistory(@Param('id') interviewId: string) {
    return this.canvasService.getSnapshotHistory(interviewId);
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'Complete interview turn and evaluate design across 5 rubric dimensions' })
  async evaluateDesign(@Param('id') interviewId: string) {
    return this.designEvaluationService.evaluateSession(interviewId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Get export metadata for system design canvas' })
  async exportCanvas(@Param('id') interviewId: string) {
    const session = await this.canvasService.getSession(interviewId);
    return {
      interviewId,
      finalCanvasUrl: session.finalCanvasUrl,
      initialPrompt: session.initialPrompt,
      snapshotCount: session.snapshots?.length || 0,
      exportedAt: new Date().toISOString(),
    };
  }
}
