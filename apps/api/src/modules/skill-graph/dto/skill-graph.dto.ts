import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompetencyArea } from '@ai-interview/contracts';

export class CreateSkillNodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ enum: CompetencyArea })
  @IsOptional()
  @IsEnum(CompetencyArea)
  competencyArea?: CompetencyArea;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameVi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3)
  level?: number;

  @ApiPropertyOptional({ default: 1.0 })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateSkillNodeDto {
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
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;
}

export class BenchmarkFilterQueryDto {
  @ApiPropertyOptional({ description: 'Target job role slug, e.g. backend' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'Target seniority slug, e.g. senior' })
  @IsOptional()
  @IsString()
  level?: string;
}

export class ProgressTrendQueryDto {
  @ApiPropertyOptional({ enum: ['7d', '30d', '90d', '180d', '365d'], default: '30d' })
  @IsOptional()
  @IsString()
  period?: '7d' | '30d' | '90d' | '180d' | '365d';
}
