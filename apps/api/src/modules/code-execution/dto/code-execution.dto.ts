import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsInt, IsArray, Min, Max, MaxLength } from 'class-validator';
import { TestCaseDto } from '@ai-interview/contracts';

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
  customInput?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  testCases?: TestCaseDto[];
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
}
