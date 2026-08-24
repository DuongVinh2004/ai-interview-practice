import { CompetencyArea } from '@ai-interview/contracts';
import { IsBoolean, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePortfolioSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Username can only contain letters, numbers, underscores and hyphens' })
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showRealName?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showBio?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showSkills?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showBadges?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showCertificates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showHistory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customBio?: string;
}

export class GenerateCertificateDto {
  @ApiPropertyOptional({ enum: CompetencyArea })
  @IsOptional()
  @IsEnum(CompetencyArea)
  competencyArea?: CompetencyArea;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}

export class RevokeCertificateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

