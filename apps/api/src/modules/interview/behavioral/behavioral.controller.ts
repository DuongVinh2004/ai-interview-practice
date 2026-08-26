import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BehavioralService } from './behavioral.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '@ai-interview/contracts';
import { IsNotEmpty, IsString, IsInt, IsOptional, Min } from 'class-validator';

export class AnalyzeStarDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsInt()
  @Min(1)
  turnNumber!: number;

  @IsString()
  @IsNotEmpty()
  questionText!: string;

  @IsString()
  @IsNotEmpty()
  candidateAnswer!: string;

  @IsString()
  @IsOptional()
  competencyArea?: string;
}

@ApiTags('Behavioral Interview')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews/behavioral')
export class BehavioralController {
  constructor(private readonly behavioralService: BehavioralService) {}

  @Post('analyze-star')
  @ApiOperation({
    summary: 'Analyze real-time answer for STAR components and generate dynamic probing questions',
  })
  async analyzeStar(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body() dto: AnalyzeStarDto,
  ) {
    return this.behavioralService.analyzeStar(dto, userId, userRole);
  }

  @Get('competencies')
  @ApiOperation({ summary: 'List all behavioral competencies and company question presets' })
  async listCompetencies() {
    return this.behavioralService.listCompetencies();
  }

  @Get('report/:answerId')
  @ApiOperation({ summary: 'Retrieve STAR evaluation report for a completed turn' })
  @ApiParam({ name: 'answerId', description: 'Answer UUID' })
  async getStarReport(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('answerId', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }))
    answerId: string,
  ) {
    return this.behavioralService.getStarEvaluationReport(userId, userRole, answerId);
  }
}
