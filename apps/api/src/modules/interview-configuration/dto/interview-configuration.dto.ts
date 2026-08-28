import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionMode, CompetencyArea } from '@ai-interview/contracts';

export class InterviewConfigurationDto {
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

  @ApiProperty({ example: 'vi', default: 'vi', required: false })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', required: false })
  @IsUUID('4')
  @IsOptional()
  blueprintId?: string;
}

export class CreatePresetRequestDto {
  @ApiProperty({ example: 'Senior Go Backend & Microservices' })
  @IsString()
  @IsNotEmpty({ message: 'Preset name is required' })
  @MaxLength(100, { message: 'Preset name cannot exceed 100 characters' })
  name!: string;

  @ApiProperty({
    example: 'Target practice for high-throughput concurrency systems',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Description cannot exceed 255 characters' })
  description?: string;

  @ApiProperty({ example: false, default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @ApiProperty({ type: InterviewConfigurationDto })
  @ValidateNested()
  @Type(() => InterviewConfigurationDto)
  @IsNotEmpty()
  config!: InterviewConfigurationDto;
}

export class UpdatePresetRequestDto {
  @ApiProperty({ example: 'Senior Go Backend & Cloud Architect', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Preset name cannot exceed 100 characters' })
  name?: string;

  @ApiProperty({ example: 'Updated description', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Description cannot exceed 255 characters' })
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @ApiProperty({ type: InterviewConfigurationDto, required: false })
  @ValidateNested()
  @Type(() => InterviewConfigurationDto)
  @IsOptional()
  config?: InterviewConfigurationDto;
}

export class ValidateConfigurationRequestDto {
  @ApiProperty({ example: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', required: false })
  @IsUUID('4')
  @IsOptional()
  presetId?: string;

  @ApiProperty({ type: InterviewConfigurationDto, required: false })
  @ValidateNested()
  @Type(() => InterviewConfigurationDto)
  @IsOptional()
  config?: InterviewConfigurationDto;
}
