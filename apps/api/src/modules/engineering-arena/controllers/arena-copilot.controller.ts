import { Controller, Post, Body, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ArenaCopilotService, CopilotQueryRequest } from '../services/arena-copilot.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Engineering Arena Copilot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('arena/copilot')
export class ArenaCopilotController {
  constructor(private readonly copilotService: ArenaCopilotService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ask AI Copilot for hints or code guidance in Arena session' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Copilot guidance response' })
  async askCopilot(@CurrentUser('id') userId: string, @Body() body: CopilotQueryRequest) {
    return this.copilotService.askCopilot(userId, body);
  }
}
