import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionMode, CompetencyArea } from '@ai-interview/contracts';
import { InterviewConfigurationDto } from './interview-configuration.dto';

export class FieldSourceDetailDto {
  @ApiProperty({ example: 'cv', enum: ['cv', 'jd', 'preset', 'manual', 'default'] })
  @IsEnum(['cv', 'jd', 'preset', 'manual', 'default'])
  @IsNotEmpty()
  source!: 'cv' | 'jd' | 'preset' | 'manual' | 'default';

  @ApiProperty({ example: 'suggested', enum: ['suggested', 'accepted', 'overridden', 'invalid'] })
  @IsEnum(['suggested', 'accepted', 'overridden', 'invalid'])
  @IsNotEmpty()
  status!: 'suggested' | 'accepted' | 'overridden' | 'invalid';

  @ApiProperty({ required: false })
  @IsOptional()
  originalValue?: any;
}

export class ExtractedProfileDto {
  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  documentId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  targetRole?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  seniorityLevel?: string;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsOptional()
  skills?: string[];

  @ApiProperty({ type: [Object], required: false })
  @IsArray()
  @IsOptional()
  experience?: any[];

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsOptional()
  education?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  rawSummary?: string;

  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  matchedJobRoleId?: string;

  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  matchedSeniorityLevelId?: string;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsOptional()
  matchedTechnologyIds?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsOptional()
  unmatchedSkills?: string[];
}

export class PartialInterviewConfigurationDto {
  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  jobRoleId?: string;

  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  seniorityLevelId?: string;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsOptional()
  technologyIds?: string[];

  @ApiProperty({ enum: SessionMode, required: false })
  @IsEnum(SessionMode)
  @IsOptional()
  sessionMode?: SessionMode;

  @ApiProperty({ enum: CompetencyArea, required: false })
  @IsEnum(CompetencyArea)
  @IsOptional()
  competencyArea?: CompetencyArea;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  totalTurns?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isSandbox?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  blueprintId?: string;
}

export class CreateSetupDraftRequestDto {
  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  cvProfileId?: string;

  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  jdProfileId?: string;

  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  selectedPresetId?: string;

  @ApiProperty({ type: ExtractedProfileDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExtractedProfileDto)
  extractedProfile?: ExtractedProfileDto;

  @ApiProperty({ type: PartialInterviewConfigurationDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialInterviewConfigurationDto)
  configurationDraft?: PartialInterviewConfigurationDto;

  @ApiProperty({ type: Object, required: false })
  @IsObject()
  @IsOptional()
  fieldSources?: Record<string, FieldSourceDetailDto>;
}

export class UpdateSetupDraftRequestDto {
  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  cvProfileId?: string;

  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  jdProfileId?: string;

  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  selectedPresetId?: string;

  @ApiProperty({ type: ExtractedProfileDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExtractedProfileDto)
  extractedProfile?: ExtractedProfileDto;

  @ApiProperty({ type: PartialInterviewConfigurationDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialInterviewConfigurationDto)
  configurationDraft?: PartialInterviewConfigurationDto;

  @ApiProperty({ type: Object, required: false })
  @IsObject()
  @IsOptional()
  fieldSources?: Record<string, FieldSourceDetailDto>;

  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'EXPIRED', 'ABANDONED'], required: false })
  @IsEnum(['ACTIVE', 'COMPLETED', 'EXPIRED', 'ABANDONED'])
  @IsOptional()
  status?: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED';
}

export class AnalyzeProfileToDraftRequestDto {
  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  cvProfileId?: string;

  @ApiProperty({ required: false })
  @IsUUID('4')
  @IsOptional()
  jdProfileId?: string;

  @ApiProperty({ type: ExtractedProfileDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExtractedProfileDto)
  extractedData?: ExtractedProfileDto;
}

export class ApplyPresetToDraftRequestDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID('4')
  @IsNotEmpty()
  presetId!: string;
}

export class ConflictFieldResolutionDto {
  @ApiProperty({ example: 'preset', enum: ['cv', 'preset', 'manual'] })
  @IsEnum(['cv', 'preset', 'manual'])
  @IsNotEmpty()
  source!: 'cv' | 'preset' | 'manual';

  @ApiProperty({ required: false })
  @IsOptional()
  customValue?: any;
}

export class ResolveConflictsRequestDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID('4')
  @IsNotEmpty()
  presetId!: string;

  @ApiProperty({
    type: Object,
    example: {
      role: { source: 'preset' },
      skills: { source: 'manual', customValue: ['tech-id-1'] },
    },
  })
  @IsObject()
  @IsNotEmpty()
  resolutions!: Record<string, ConflictFieldResolutionDto>;
}
