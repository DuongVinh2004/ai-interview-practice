import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  UseGuards,
  Sse,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiParam } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { InterviewService } from './interview.service';
import { SseService, SseSessionEvent } from '../platform/sse/sse.service';
import { IdempotencyService } from '../platform/guards/idempotency.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '@ai-interview/contracts';
import {
  CreateInterviewRequestDto,
  SubmitAnswerRequestDto,
  ReEvaluateTurnRequestDto,
} from './dto/interview.dto';

@ApiTags('Interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews')
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly sseService: SseService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new 5-turn interview session' })
  async createInterview(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateInterviewRequestDto,
  ) {
    return this.interviewService.createSession(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full interview session by ID' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async getInterview(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
  ) {
    return this.interviewService.getSession(userId, userRole, id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get lightweight interview session status (REST polling fallback)' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async getInterviewStatus(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
  ) {
    return this.interviewService.getSessionStatus(userId, userRole, id);
  }

  @Post(':id/answers')
  @ApiOperation({ summary: 'Submit text answer for the current active question turn' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Unique client-provided key to guarantee exactly-once submission processing',
  })
  async submitAnswer(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: SubmitAnswerRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const reservation = await this.idempotencyService.reserveKey(
        idempotencyKey,
        userId,
        `interview-answer-${sessionId}`,
        dto,
      );
      if (reservation.isCached) {
        return reservation.cachedResponse;
      }
    }

    try {
      const result = await this.interviewService.submitAnswer(userId, sessionId, dto);

      if (idempotencyKey) {
        await this.idempotencyService.completeKey(idempotencyKey, HttpStatus.OK, result);
      }

      return result;
    } catch (err) {
      if (idempotencyKey) {
        await this.idempotencyService.releaseKey(idempotencyKey);
      }
      throw err;
    }
  }

  @Post(':id/turns/:turnNumber/re-evaluate')
  @ApiOperation({ summary: 'Request re-evaluation for a specific turn answer' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  @ApiParam({ name: 'turnNumber', description: 'Turn number (1-5)' })
  async reEvaluateTurn(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
    @Param('turnNumber') turnNumber: string,
    @Body() dto: ReEvaluateTurnRequestDto,
  ) {
    return this.interviewService.reEvaluateTurn(
      userId,
      userRole,
      sessionId,
      parseInt(turnNumber, 10),
      dto,
    );
  }

  @Sse(':id/events')
  @ApiOperation({ summary: 'Server-Sent Events stream for real-time interview progression' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async sseInterviewEvents(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
  ): Promise<Observable<{ data: SseSessionEvent }>> {
    await this.interviewService.assertSessionAccess(userId, userRole, sessionId);
    return this.sseService.getSessionEventStream(sessionId);
  }
}
