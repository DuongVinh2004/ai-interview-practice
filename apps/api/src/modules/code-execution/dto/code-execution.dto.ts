import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TestCaseItemDto {
  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: '2, 3' })
  @IsString()
  @MaxLength(10000)
  input!: string;

  @ApiProperty({ example: '5' })
  @IsString()
  @MaxLength(10000)
  expectedOutput!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class ExecuteCodeDto {
  @ApiProperty({ example: 'javascript' })
  @IsString()
  @IsNotEmpty()
  language!: string;

  @ApiProperty({ example: 'function solution() { return true; }' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  sourceCode!: string;

  @ApiPropertyOptional({ example: '2, 3' })
  @IsString()
  @IsOptional()
  @MaxLength(50000)
  customInput?: string;

  @ApiPropertyOptional({ example: '-O2' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  compilerOptions?: string;

  @ApiPropertyOptional({ type: [TestCaseItemDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TestCaseItemDto)
  testCases?: TestCaseItemDto[];
}

export class SubmitCodeDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(10)
  turnNumber!: number;

  @ApiProperty({ example: 'python' })
  @IsString()
  @IsNotEmpty()
  language!: string;

  @ApiProperty({ example: 'def solution():\n    pass' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  sourceCode!: string;

  @ApiPropertyOptional({ example: '-O2' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  compilerOptions?: string;
}
