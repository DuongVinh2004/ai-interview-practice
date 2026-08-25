import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsString,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShareExpiryDuration } from '@ai-interview/contracts';

export class CreateShareTokenDto {
  @ApiProperty({ enum: ShareExpiryDuration, default: ShareExpiryDuration.SEVEN_DAYS })
  @IsEnum(ShareExpiryDuration)
  @IsOptional()
  expiry?: ShareExpiryDuration = ShareExpiryDuration.SEVEN_DAYS;

  @ApiPropertyOptional({
    description: 'Whether candidate name & email should be redacted in public view',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isAnonymized?: boolean = false;

  @ApiPropertyOptional({
    description: 'Optional passcode required to view report',
    minLength: 4,
    maxLength: 30,
  })
  @IsString()
  @MinLength(4)
  @MaxLength(30)
  @IsOptional()
  passcode?: string;
}

export class AddMentorFeedbackDto {
  @ApiPropertyOptional({
    description: 'Turn number (1-5) if feedback applies to a specific turn',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  turnNumber?: number;

  @ApiProperty({ description: 'Name or title of mentor/reviewer', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  mentorName!: string;

  @ApiProperty({
    description: 'Constructive commentary, suggestions, or advice',
    minLength: 5,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  comment!: string;
}
