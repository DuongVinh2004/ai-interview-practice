import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { LearningPathService } from './learning-path.service';
import { UpdateLearningPathItemDto } from './dto/learning-path.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '@ai-interview/contracts';

@ApiTags('Learning Path')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class LearningPathController {
  constructor(private readonly learningPathService: LearningPathService) {}

  @Get('interviews/:id/learning-path')
  @ApiOperation({ summary: 'Get generated learning path for an interview session' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async getLearningPath(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('id') sessionId: string,
  ) {
    return this.learningPathService.getLearningPath(userId, userRole, sessionId);
  }

  @Post('interviews/:id/learning-path/regenerate')
  @ApiOperation({ summary: 'Trigger idempotent regeneration of learning path' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async regenerateLearningPath(@CurrentUser('sub') userId: string, @Param('id') sessionId: string) {
    return this.learningPathService.regenerateLearningPath(userId, sessionId);
  }

  @Patch('interviews/:id/learning-path/items/:itemId')
  @ApiOperation({ summary: 'Toggle completion status of a learning recommendation' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  @ApiParam({ name: 'itemId', description: 'Learning path item ID' })
  async updateItemStatus(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateLearningPathItemDto,
  ) {
    return this.learningPathService.updateItemStatus(userId, sessionId, itemId, dto.isCompleted);
  }

  @Get('learning-path/my-goals')
  @ApiOperation({ summary: 'Aggregate all actionable learning goals for current user' })
  async getMyLearningGoals(@CurrentUser('sub') userId: string) {
    return this.learningPathService.getMyLearningGoals(userId);
  }
}
