import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LockUserRequestDto {
  @ApiPropertyOptional({ example: 'Violated terms of service' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
