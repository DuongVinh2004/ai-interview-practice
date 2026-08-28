import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Sse,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EngineeringArenaService } from './engineering-arena.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StartArenaSessionRequest } from '@ai-interview/contracts';

@ApiTags('Engineering Arena')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('arena')
export class EngineeringArenaController {
  constructor(private readonly arenaService: EngineeringArenaService) {}

  @Get('challenges')
  @ApiOperation({ summary: 'List published engineering challenges' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of published challenges' })
  async listChallenges(
    @Query('domain') domain?: string,
    @Query('category') category?: string,
  ) {
    return this.arenaService.listChallenges({ domain, category });
  }

  @Get('challenges/:slug')
  @ApiOperation({ summary: 'Get challenge details by slug' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Challenge detail' })
  async getChallengeBySlug(@Param('slug') slug: string) {
    return this.arenaService.getChallengeBySlug(slug);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new Engineering Arena session' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Arena session started' })
  async startSession(
    @CurrentUser('id') userId: string,
    @Body() body: StartArenaSessionRequest,
  ) {
    return this.arenaService.startSession(userId, body);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get Arena session status by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Arena session details' })
  async getSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.arenaService.getSession(sessionId, userId);
  }

  @Sse('sessions/:id/stream')
  @ApiOperation({ summary: 'Subscribe to real-time SSE execution logs for session' })
  streamSessionLogs(@Param('id') sessionId: string) {
    return this.arenaService.getSessionSseStream(sessionId);
  }

  @Post('sessions/:id/run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run allowed command in Arena workspace' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Command execution result' })
  async runCommand(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
    @Body() body: { commandId: string; modifiedFiles?: Array<{ path: string; content: string }> },
  ) {
    return this.arenaService.runCommand(sessionId, userId, body);
  }

  @Post('sessions/:id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit solution for evaluation' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Evaluation response' })
  async submitSolution(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
    @Body() body: { explanation?: string; finalFiles: Array<{ path: string; content: string }> },
  ) {
    return this.arenaService.submitSolution(sessionId, userId, body);
  }
}


