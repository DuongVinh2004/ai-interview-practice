import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsInt,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitCanvasSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  initialPrompt?: string;
}

export class UploadCanvasSnapshotDto {
  @ApiProperty({ description: 'Base64 image data URL or object storage URL (max 2MB payload)' })
  @IsString()
  @MaxLength(2_000_000, { message: 'imageUrl exceeds maximum allowable length of 2MB' })
  imageUrl!: string;

  @ApiPropertyOptional({ description: 'Serialized canvas state JSON' })
  @IsOptional()
  @IsObject()
  canvasStateJson?: Record<string, any>;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(0)
  @Max(86400)
  elapsedSeconds?: number;
}

export class EvaluateDesignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  finalPrompt?: string;
}
