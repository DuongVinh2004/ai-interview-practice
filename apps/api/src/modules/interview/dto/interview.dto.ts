import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { SessionMode, CompetencyArea } from '@ai-interview/contracts';

export class CreateInterviewRequestDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID('4', { message: 'jobRoleId must be a valid UUID' })
  @IsNotEmpty()
  jobRoleId!: string;

  @ApiProperty({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID('4', { message: 'seniorityLevelId must be a valid UUID' })
  @IsNotEmpty()
  seniorityLevelId!: string;

  @ApiProperty({ example: ['c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least 1 technology' })
  @ArrayMaxSize(5, { message: 'You can select at most 5 technologies' })
  @IsUUID('4', { each: true, message: 'Each technology ID must be a valid UUID' })
  technologyIds!: string[];

  @ApiProperty({ enum: SessionMode, default: SessionMode.STANDARD, required: false })
  @IsEnum(SessionMode)
  @IsOptional()
  sessionMode?: SessionMode;

  @ApiProperty({ enum: CompetencyArea, required: false })
  @IsEnum(CompetencyArea)
  @IsOptional()
  competencyArea?: CompetencyArea;

  @ApiProperty({ example: 5, default: 5, required: false, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  totalTurns?: number;

  @ApiProperty({ example: false, default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isSandbox?: boolean;

  @ApiProperty({ example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', required: false })
  @IsUUID('4')
  @IsOptional()
  blueprintId?: string;
}

export class SubmitAnswerRequestDto {
  @ApiProperty({ example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID('4', { message: 'turnId must be a valid UUID' })
  @IsNotEmpty()
  turnId!: string;

  @ApiProperty({
    example:
      'In a production React application, state management should be segregated into server state and client state...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Answer text cannot be empty' })
  @MaxLength(5000, { message: 'Answer text cannot exceed 5,000 characters' })
  answerText!: string;
}

export class ReEvaluateTurnRequestDto {
  @ApiProperty({ example: 'I added concrete architectural mechanisms and would like a re-evaluation.', required: false })
  @IsString()
  @MaxLength(500, { message: 'Reason cannot exceed 500 characters' })
  reason?: string;
}

