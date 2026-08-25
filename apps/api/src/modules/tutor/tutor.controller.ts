import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TutorService } from './tutor.service';
import {
  CreateTutorSessionRequestSchema,
  AskTutorRequestSchema,
  QuestionRetryRequestSchema,
  TutorRatingRequestSchema,
} from '@ai-interview/contracts';

@Controller('tutor')
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  @Post('sessions')
  async createSession(@CurrentUser('sub') userId: string, @Body() body: any) {
    const parsed = CreateTutorSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid session payload');
    }
    return this.tutorService.createOrGetSession(userId, parsed.data);
  }

  @Get('sessions/:id')
  async getSession(@CurrentUser('sub') userId: string, @Param('id') sessionId: string) {
    return this.tutorService.getSession(userId, sessionId);
  }

  @Post('sessions/:id/chat')
  async chatStream(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const parsed = AskTutorRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid chat message');
    }
    return this.tutorService.sendChatMessageStream(userId, sessionId, parsed.data, res);
  }

  @Post('retry')
  async submitRetry(@CurrentUser('sub') userId: string, @Body() body: any) {
    const parsed = QuestionRetryRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid retry payload');
    }
    return this.tutorService.submitRetry(userId, parsed.data);
  }

  @Post('sessions/:id/rate')
  async rateTutor(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Body() body: any,
  ) {
    const parsed = TutorRatingRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid rating payload');
    }
    return this.tutorService.rateTutor(userId, sessionId, parsed.data);
  }
}
