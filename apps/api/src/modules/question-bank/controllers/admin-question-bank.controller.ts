import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QuestionBankService } from '../services/question-bank.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRole } from '@ai-interview/contracts';
import {
  AdminCreateQuestionDto,
  AdminUpdateQuestionDto,
  AdminReviewQuestionDto,
} from '../dto/question-bank.dto';

@ApiTags('Admin Question Bank')
@Controller('admin/question-bank')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminQuestionBankController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @Get('questions')
  @ApiOperation({ summary: 'Admin list questions across all publication states' })
  async listQuestions(@Query() query: any) {
    return this.questionBankService.adminListQuestions(query);
  }

  @Get('questions/:id')
  @ApiOperation({ summary: 'Admin get question details with answer versions and audit history' })
  async getQuestion(@Param('id') id: string) {
    return this.questionBankService.adminGetQuestion(id);
  }

  @Post('questions')
  @ApiOperation({ summary: 'Create and publish a question with its initial answer' })
  async createQuestion(@Body() dto: AdminCreateQuestionDto, @CurrentUser('id') authorId: string) {
    return this.questionBankService.adminCreateQuestion(dto, authorId);
  }

  @Patch('questions/:id')
  @ApiOperation({ summary: 'Update draft question or create new revision' })
  async updateQuestion(
    @Param('id') id: string,
    @Body() dto: AdminUpdateQuestionDto,
    @CurrentUser('id') editorId: string,
  ) {
    return this.questionBankService.adminUpdateQuestion(id, dto, editorId);
  }

  @Post('questions/:id/submit-review')
  @ApiOperation({ summary: 'Submit draft question for review (DRAFT -> IN_REVIEW)' })
  async submitReview(@Param('id') id: string, @CurrentUser('id') submitterId: string) {
    return this.questionBankService.adminSubmitReview(id, submitterId);
  }

  @Post('questions/:id/review')
  @ApiOperation({ summary: 'Review question (Approve/Reject). Reviewer cannot be author.' })
  async reviewQuestion(
    @Param('id') id: string,
    @Body() dto: AdminReviewQuestionDto,
    @CurrentUser('id') reviewerId: string,
  ) {
    return this.questionBankService.adminReview(id, dto, reviewerId);
  }

  @Post('questions/:id/publish')
  @ApiOperation({ summary: 'Publish approved question' })
  async publishQuestion(@Param('id') id: string, @CurrentUser('id') publisherId: string) {
    return this.questionBankService.adminPublish(id, publisherId);
  }

  @Post('questions/:id/archive')
  @ApiOperation({ summary: 'Archive published question' })
  async archiveQuestion(@Param('id') id: string, @CurrentUser('id') archiverId: string) {
    return this.questionBankService.adminArchive(id, archiverId);
  }

  @Get('reconciliation')
  @ApiOperation({ summary: 'Reconciliation report between access grants and usage ledger' })
  async getReconciliation() {
    return this.questionBankService.adminReconciliation();
  }
}
