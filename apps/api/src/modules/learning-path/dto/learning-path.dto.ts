import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateLearningPathItemDto {
  @ApiProperty({ example: true, description: 'Mark learning item as completed or pending' })
  @IsBoolean()
  @IsNotEmpty()
  isCompleted!: boolean;
}
