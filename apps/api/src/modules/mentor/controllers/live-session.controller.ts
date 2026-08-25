import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { LiveSessionService } from '../services/live-session.service';
import { CopilotHintService } from '../services/copilot-hint.service';
import { MentorNotesDto, ScoreOverrideDto, CandidateRatingDto } from '../dto/mentor.dto';

@ApiTags('Live Session & Co-Pilot (F012)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class LiveSessionController {
  constructor(
    private readonly liveSessionService: LiveSessionService,
    private readonly copilotHintService: CopilotHintService,
  ) {}

  @Post('sessions/:id/join')
  @ApiOperation({ summary: 'Join live interview room and obtain ephemeral media token' })
  async joinSession(
    @Param('id') sessionId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.liveSessionService.joinSession(sessionId, userId);
  }

  @Post('sessions/:id/start')
  @ApiOperation({ summary: 'Mentor starts the live interview session' })
  async startSession(
    @Param('id') sessionId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.liveSessionService.startSession(sessionId, userId);
  }

  @Post('sessions/:id/end')
  @ApiOperation({ summary: 'Mentor completes the live interview session' })
  async endSession(
    @Param('id') sessionId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.liveSessionService.endSession(sessionId, userId);
  }

  @Post('sessions/:id/notes')
  @ApiOperation({ summary: 'Save private mentor notes for the session' })
  async saveNotes(
    @Param('id') sessionId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: MentorNotesDto,
  ) {
    return this.liveSessionService.saveMentorNotes(sessionId, userId, dto.notes);
  }

  @Post('evaluations/:id/override')
  @ApiOperation({ summary: 'Mentor overrides automated AI score with mandatory justification note' })
  async overrideScore(
    @Param('id') evaluationId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: ScoreOverrideDto,
  ) {
    return this.liveSessionService.overrideScore(
      evaluationId,
      userId,
      dto.newScore,
      dto.justification,
    );
  }

  @Post('sessions/:id/rate')
  @ApiOperation({ summary: 'Candidate rates mentor performance (1-5 stars)' })
  async rateMentor(
    @Param('id') sessionId: string,
    @CurrentUser('sub') candidateId: string,
    @Body() dto: CandidateRatingDto,
  ) {
    return this.liveSessionService.rateMentor(sessionId, candidateId, dto.rating, dto.feedback);
  }

  @Get('sessions/:id/copilot-hints')
  @ApiOperation({ summary: 'Fetch real-time AI probing question suggestions for mentor' })
  async getCopilotHints(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.copilotHintService.getProbingHints(sessionId, undefined, userId);
  }
}
