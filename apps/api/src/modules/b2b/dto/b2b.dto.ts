import { AssignmentStatus, SessionMode } from '@ai-interview/contracts';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BrandingConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ example: '#3B82F6' })
  @IsString()
  @IsNotEmpty()
  primaryColor!: string;

  @ApiProperty({ example: '#10B981' })
  @IsString()
  @IsNotEmpty()
  accentColor!: string;

  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  companyName?: string;
}

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @ApiPropertyOptional({ example: 'acme.com' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ type: BrandingConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingConfigDto)
  brandingConfig?: BrandingConfigDto;
}

export class UpdateBrandingDto {
  @ApiProperty({ type: BrandingConfigDto })
  @IsObject()
  @ValidateNested()
  @Type(() => BrandingConfigDto)
  brandingConfig!: BrandingConfigDto;
}

export class CreateCohortDto {
  @ApiProperty({ example: 'Frontend Engineering Cohort Q3' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Q3 Batch for 2026' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class ImportRosterDto {
  @ApiProperty({ example: 'email,fullName\njohn@example.com,John Doe' })
  @IsString()
  @IsNotEmpty()
  csvContent!: string;
}

export class AssignmentConfigDto {
  @ApiPropertyOptional({ enum: SessionMode })
  @IsOptional()
  @IsEnum(SessionMode)
  sessionMode?: SessionMode;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional({ example: 7.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  targetScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rubricId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionBankId?: string;
}

export class CreateAssignmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  cohortId!: string;

  @ApiProperty({ example: 'Midterm Technical Assessment' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deadline?: string;

  @ApiPropertyOptional({ type: AssignmentConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssignmentConfigDto)
  config?: AssignmentConfigDto;
}

export class PublishAssignmentDto {
  @ApiProperty({ enum: AssignmentStatus })
  @IsEnum(AssignmentStatus)
  status!: AssignmentStatus;
}

export class CreateApiKeyDto {
  @ApiProperty({ example: 'CI/CD Pipeline Key' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
