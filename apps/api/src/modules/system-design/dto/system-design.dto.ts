import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitCanvasSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  initialPrompt?: string;
}

export class UploadCanvasSnapshotDto {
  @ApiProperty({ description: 'Base64 image data URL or object storage URL' })
  @IsString()
  imageUrl!: string;

  @ApiPropertyOptional({ description: 'Serialized canvas state JSON' })
  @IsOptional()
  canvasStateJson?: any;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  elapsedSeconds?: number;
}

export class EvaluateDesignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  finalPrompt?: string;
}
