import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { QuestionBankService } from '../services/question-bank.service';
import { QuestionBankEntitlementService } from '../services/question-bank-entitlement.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QuestionBankQueryDto, CreateQuestionFeedbackDto } from '../dto/question-bank.dto';

@ApiTags('Question Bank')
@Controller('question-bank')
@UseGuards(JwtAuthGuard)
export class QuestionBankController {
  constructor(
    private readonly questionBankService: QuestionBankService,
    private readonly entitlementService: QuestionBankEntitlementService,
  ) {}

  @Public()
  @Get('questions')
  @ApiOperation({ summary: 'Browse and filter published question bank questions' })
  @ApiResponse({ status: 200, description: 'Paginated list of questions without answers' })
  async listQuestions(@Query() query: QuestionBankQueryDto, @CurrentUser('id') userId?: string) {
    return this.questionBankService.listQuestions(query, userId);
  }

  @Public()
  @Get('questions/:slug')
  @ApiOperation({ summary: 'Get question details and safe answer preview' })
  @ApiResponse({ status: 200, description: 'Question details with safe answer projection' })
  async getQuestion(@Param('slug') slug: string, @CurrentUser('id') userId?: string) {
    return this.questionBankService.getQuestionBySlug(slug, userId);
  }

  @Post('questions/:id/reveal-answer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reveal full answer based on entitlement & quota' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique client operation key to prevent duplicate quota charges',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Revealed answer and updated quota' })
  @ApiResponse({ status: 403, description: 'Quota exhausted or entitlement required' })
  async revealAnswer(
    @Param('id') questionId: string,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKeyLower?: string,
    @Headers('Idempotency-Key') idempotencyKeyUpper?: string,
  ) {
    const key = idempotencyKeyLower || idempotencyKeyUpper;
    return this.questionBankService.revealAnswer(questionId, userId, key);
  }

  @Get('access-status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user plan, effective entitlements and quota limits' })
  @ApiResponse({ status: 200, description: 'Entitlement and quota status' })
  async getAccessStatus(@CurrentUser('id') userId: string) {
    return this.entitlementService.getEffectiveEntitlement(userId);
  }

  @Post('questions/:id/bookmark')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add question to bookmarks' })
  async addBookmark(@Param('id') questionId: string, @CurrentUser('id') userId: string) {
    return this.questionBankService.addBookmark(questionId, userId);
  }

  @Delete('questions/:id/bookmark')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove question from bookmarks' })
  async removeBookmark(@Param('id') questionId: string, @CurrentUser('id') userId: string) {
    return this.questionBankService.removeBookmark(questionId, userId);
  }

  @Get('bookmarks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user bookmarked questions' })
  async listBookmarks(@Query() query: QuestionBankQueryDto, @CurrentUser('id') userId: string) {
    return this.questionBankService.listBookmarks(userId, query);
  }

  @Post('questions/:id/feedback')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit feedback / error report for a question' })
  async submitFeedback(
    @Param('id') questionId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateQuestionFeedbackDto,
  ) {
    return this.questionBankService.submitFeedback(questionId, userId, dto);
  }
}
