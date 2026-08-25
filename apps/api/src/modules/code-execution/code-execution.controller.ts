import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CodeExecutionService } from './code-execution.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExecuteCodeDto, SubmitCodeDto } from './dto/code-execution.dto';

@ApiTags('Code Execution')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews')
export class CodeExecutionController {
  constructor(private readonly codeExecutionService: CodeExecutionService) {}

  @Post(':id/code/execute')
  @ApiOperation({ summary: 'Execute candidate source code in sandbox environment' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async executeCode(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: ExecuteCodeDto,
  ) {
    return this.codeExecutionService.executeCode(userId, sessionId, dto);
  }

  @Post(':id/code/submit')
  @ApiOperation({ summary: 'Submit final code, execute test cases, and trigger AI code review' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async submitCode(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: SubmitCodeDto,
  ) {
    return this.codeExecutionService.submitCode(userId, sessionId, dto);
  }

  @Get(':id/code/submissions')
  @ApiOperation({ summary: 'List code submissions for an interview session' })
  @ApiParam({ name: 'id', description: 'Interview session ID' })
  async getSubmissions(@CurrentUser('sub') userId: string, @Param('id') sessionId: string) {
    return this.codeExecutionService.getSubmissions(userId, sessionId);
  }
}
