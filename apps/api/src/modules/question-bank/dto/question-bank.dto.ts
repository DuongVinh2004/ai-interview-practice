import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  QuestionPublicationStatus,
  QuestionAnswerAuthority,
  QuestionFeedbackReason,
} from '@ai-interview/contracts';

export class QuestionBankQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Job role slug or UUID' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'Seniority level slug or UUID' })
  @IsOptional()
  @IsString()
  seniority?: string;

  @ApiPropertyOptional({ description: 'Technology slug or UUID' })
  @IsOptional()
  @IsString()
  technology?: string;

  @ApiPropertyOptional({ description: 'Difficulty calibrated scale 1-5' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional({
    description: 'Question format/type (e.g. conceptual, coding, system_design, behavioral)',
  })
  @IsOptional()
  @IsString()
  questionType?: string;

  @ApiPropertyOptional({ default: 'vi' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class CreateQuestionFeedbackDto {
  @ApiProperty({ enum: QuestionFeedbackReason, default: QuestionFeedbackReason.OTHER })
  @IsEnum(QuestionFeedbackReason)
  @IsNotEmpty()
  reason!: QuestionFeedbackReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}

export class InitialAnswerDto {
  @ApiProperty({ enum: QuestionAnswerAuthority, default: QuestionAnswerAuthority.REFERENCE })
  @IsEnum(QuestionAnswerAuthority)
  authority: QuestionAnswerAuthority = QuestionAnswerAuthority.REFERENCE;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  answerBody!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanationBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  rubric?: any;

  @ApiPropertyOptional()
  @IsOptional()
  commonMistakes?: any;

  @ApiPropertyOptional({ default: 'curated' })
  @IsOptional()
  @IsString()
  sourceType: string = 'curated';
}

export class AdminCreateQuestionDto {
  @ApiProperty({ example: 'Idempotency in distributed payments' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ example: 'idempotency-in-distributed-payments' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ApiProperty({ example: 'How do you design an idempotent payment API?' })
  @IsString()
  @IsNotEmpty()
  questionBody!: string;

  @ApiProperty({ example: 'scenario' })
  @IsString()
  @IsNotEmpty()
  questionType!: string;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 5, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty: number = 3;

  @ApiPropertyOptional({ default: 'vi' })
  @IsOptional()
  @IsString()
  language: string = 'vi';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  jobRoleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  seniorityLevelId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  technologyIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  minimumEntitlement?: string;

  @ApiProperty({ type: InitialAnswerDto })
  @ValidateNested()
  @Type(() => InitialAnswerDto)
  @IsNotEmpty()
  initialAnswer!: InitialAnswerDto;
}

export class AdminUpdateQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  jobRoleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  seniorityLevelId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  technologyIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  minimumEntitlement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  answerBody?: string;

  @ApiPropertyOptional({ enum: QuestionAnswerAuthority })
  @IsOptional()
  @IsEnum(QuestionAnswerAuthority)
  authority?: QuestionAnswerAuthority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanationBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  rubric?: any;

  @ApiPropertyOptional()
  @IsOptional()
  commonMistakes?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceType?: string;
}

export class AdminReviewQuestionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsString()
  @IsNotEmpty()
  action!: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;
}

export class AdminListQuestionsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: QuestionPublicationStatus })
  @IsOptional()
  @IsEnum(QuestionPublicationStatus)
  status?: QuestionPublicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
