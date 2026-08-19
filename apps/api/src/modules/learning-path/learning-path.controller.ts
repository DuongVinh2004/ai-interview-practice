import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { LearningPathService } from './learning-path.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '@ai-interview/contracts';

@ApiTags('Learning Path')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews/:id/learning-path')
export class LearningPathController {
  constructor(private readonly learningPathService: LearningPathService) {}

  @Get()
  @ApiOperation({ summary: 'Get generated learning path for an interview session' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async getLearningPath(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
  ) {
    return this.learningPathService.getLearningPath(userId, userRole, sessionId);
  }

  @Post('regenerate')
  @ApiOperation({ summary: 'Trigger idempotent regeneration of learning path' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async regenerateLearningPath(@CurrentUser('sub') userId: string, @Param('id') sessionId: string) {
    return this.learningPathService.regenerateLearningPath(userId, sessionId);
  }
}
