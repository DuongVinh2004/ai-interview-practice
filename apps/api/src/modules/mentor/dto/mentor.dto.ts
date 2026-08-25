import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AvailabilitySlotDto {
  @ApiProperty({ example: 1, description: '0 (Sun) to 6 (Sat)' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateMentorProfileDto {
  @ApiProperty({ example: ['System Design', 'Backend Architecture'] })
  @IsArray()
  @IsString({ each: true })
  expertiseAreas!: string[];

  @ApiPropertyOptional({ example: '10+ years backend architect' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [AvailabilitySlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  availabilities?: AvailabilitySlotDto[];
}

export class SetAvailabilityDto {
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots!: AvailabilitySlotDto[];
}

export class BookSessionDto {
  @ApiProperty({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsString()
  @IsNotEmpty()
  mentorId!: string;

  @ApiProperty({ example: '2026-08-25T14:00:00.000Z' })
  @IsString()
  @IsNotEmpty()
  scheduledAt!: string;
}

export class MentorNotesDto {
  @ApiProperty({ example: 'Candidate demonstrated strong distributed locking knowledge.' })
  @IsString()
  @IsNotEmpty()
  notes!: string;
}

export class ScoreOverrideDto {
  @ApiProperty({ example: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsString()
  @IsNotEmpty()
  evaluationId!: string;

  @ApiProperty({ example: 8.5 })
  @IsNumber()
  @Min(0)
  @Max(10)
  newScore!: number;

  @ApiProperty({ example: 'Candidate explained trade-offs verbally during live session.' })
  @IsString()
  @IsNotEmpty()
  justification!: string;
}

export class CandidateRatingDto {
  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'Very helpful and structured session!' })
  @IsOptional()
  @IsString()
  feedback?: string;
}
