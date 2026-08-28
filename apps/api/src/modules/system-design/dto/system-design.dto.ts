import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsInt,
  IsObject,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CanvasNodeDto {
  @ApiProperty({ example: 'node-1' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'LOAD_BALANCER' })
  @IsString()
  type!: string;

  @ApiProperty({ example: 'Nginx Load Balancer' })
  @IsString()
  label!: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  x!: number;

  @ApiProperty({ example: 150 })
  @IsNumber()
  y!: number;

  @ApiPropertyOptional({ default: 140 })
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional({ default: '#4f46e5' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Architecture node metadata' })
  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;
}

export class CanvasConnectorDto {
  @ApiProperty({ example: 'conn-1' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'node-1' })
  @IsString()
  fromId!: string;

  @ApiProperty({ example: 'node-2' })
  @IsString()
  toId!: string;

  @ApiPropertyOptional({ default: 'HTTP/REST' })
  @IsOptional()
  @IsString()
  protocol?: string;

  @ApiPropertyOptional({ example: 'Port 80/443' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;
}

export class CanvasStateDto {
  @ApiPropertyOptional({ type: [CanvasNodeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CanvasNodeDto)
  elements?: CanvasNodeDto[];

  @ApiPropertyOptional({ type: [CanvasConnectorDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CanvasConnectorDto)
  connectors?: CanvasConnectorDto[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  version?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  etag?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  zoom?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  panX?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  panY?: number;
}

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

  @ApiPropertyOptional({ description: 'Expected current version for concurrency check' })
  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(0)
  expectedVersion?: number;

  @ApiPropertyOptional({ description: 'If-Match ETag for optimistic concurrency control' })
  @IsOptional()
  @IsString()
  ifMatchEtag?: string;
}

export class EvaluateDesignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  finalPrompt?: string;
}

export class ExportCanvasQueryDto {
  @ApiPropertyOptional({ enum: ['svg', 'png', 'json'], default: 'svg' })
  @IsOptional()
  @IsString()
  @IsIn(['svg', 'png', 'json'])
  format?: 'svg' | 'png' | 'json';
}
