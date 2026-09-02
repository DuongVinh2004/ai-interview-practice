import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  Query,
  Req,
  UseGuards,
  Sse,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiParam } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { InterviewService } from './interview.service';
import { SseService, SseSessionEvent } from '../platform/sse/sse.service';
import { IdempotencyService } from '../platform/guards/idempotency.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { UserRole, BillingMetric, ErrorCode, JwtPayload } from '@ai-interview/contracts';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { QuotaGuard, RequireQuota } from '../billing/guards/quota.guard';
import {
  CreateInterviewRequestDto,
  SubmitAnswerRequestDto,
  ReEvaluateTurnRequestDto,
} from './dto/interview.dto';

const SSE_QUERY_CREDENTIAL_KEYS = new Set([
  'access_token',
  'auth',
  'authorization',
  'refresh_token',
  'token',
]);

@ApiTags('Interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews')
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly sseService: SseService,
    private readonly idempotencyService: IdempotencyService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @UseGuards(QuotaGuard)
  @RequireQuota(BillingMetric.SESSION_COUNT)
  @ApiOperation({ summary: 'Create a new 5-turn interview session' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Unique client-provided key to guarantee exactly-once session creation',
  })
  async createInterview(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateInterviewRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const reservation = await this.idempotencyService.reserveKey(
        idempotencyKey,
        userId,
        'interview-create',
        dto,
      );
      if (reservation.isCached) {
        return reservation.cachedResponse;
      }
    }

    try {
      const result = await this.interviewService.createSession(userId, dto);
      if (idempotencyKey) {
        await this.idempotencyService.completeKey(idempotencyKey, HttpStatus.CREATED, result);
      }
      return result;
    } catch (err: unknown) {
      if (idempotencyKey) {
        await this.idempotencyService.releaseKey(idempotencyKey);
      }
      throw err;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full interview session by ID' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async getInterview(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
  ) {
    return this.interviewService.getSession(user.sub, user.role as UserRole, id, user.mfaVerified);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get lightweight interview session status (REST polling fallback)' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async getInterviewStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
  ) {
    return this.interviewService.getSessionStatus(
      user.sub,
      user.role as UserRole,
      id,
      user.mfaVerified,
    );
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
    @CurrentUser('mfaVerified') mfaVerified: boolean | undefined,
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
      mfaVerified,
    );
  }

  @SkipThrottle({ default: true, short: true })
  @Public()
  @Sse(':id/events')
  @ApiOperation({ summary: 'Server-Sent Events stream for real-time interview progression' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async sseInterviewEvents(
    @Param('id') sessionId: string,
    @Query('token') queryToken?: string,
    @Req() req?: Request,
  ): Promise<Observable<{ data: SseSessionEvent }>> {
    const hasQueryCredential =
      queryToken !== undefined ||
      Object.keys(req?.query ?? {}).some(key => SSE_QUERY_CREDENTIAL_KEYS.has(key.toLowerCase()));

    if (hasQueryCredential) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Query credentials are not supported for SSE streams',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const authHeader = req?.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const token = bearerToken;

    if (!token) {
      throw new DomainException(
        ErrorCode.UNAUTHORIZED,
        'Authentication token required for SSE stream',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const payload = await this.authService.validateAccessToken(token);
    await this.interviewService.assertSessionAccess(
      payload.sub,
      payload.role as UserRole,
      sessionId,
      payload.mfaVerified,
    );
    return this.sseService.getSessionEventStream(sessionId);
  }
}
