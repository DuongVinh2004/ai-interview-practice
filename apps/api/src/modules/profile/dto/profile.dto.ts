import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileRequestDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: 'Frontend Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetRole?: string;

  @ApiPropertyOptional({ example: 'Senior' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetLevel?: string;

  @ApiPropertyOptional({ example: '5 years React & TypeScript experience' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
