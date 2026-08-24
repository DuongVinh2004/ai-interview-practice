import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompetencyArea } from '@ai-interview/contracts';

export class CreateWeightProfileDto {
  @ApiProperty()
  @IsString()
  jobRoleSlug!: string;

  @ApiProperty({ enum: CompetencyArea })
  @IsEnum(CompetencyArea)
  competencyArea!: CompetencyArea;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1.0)
  weight!: number;
}

export class UpdateWeightProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1.0)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameVi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minReadinessScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minCompetencyScore?: number;
}

export class ReadinessHistoryQueryDto {
  @ApiPropertyOptional({ enum: ['30d', '90d', '180d', '365d'], default: '30d' })
  @IsOptional()
  @IsString()
  period?: '30d' | '90d' | '180d' | '365d';
}

export class ReadinessQueryDto {
  @ApiPropertyOptional({ description: 'Target job role slug, e.g. backend' })
  @IsOptional()
  @IsString()
  role?: string;
}
