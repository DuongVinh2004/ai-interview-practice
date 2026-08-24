import { ApiProperty } from '@nestjs/swagger';
import { CompetencyArea } from '@ai-interview/contracts';

export class CompetencyScoreResponseDto {
  @ApiProperty({ enum: CompetencyArea })
  competency!: CompetencyArea;

  @ApiProperty({ description: 'Display name for competency' })
  name!: string;

  @ApiProperty({ description: 'Average score in competency (0-10)' })
  score!: number;

  @ApiProperty({ description: 'Number of evaluated answer samples' })
  sampleCount!: number;

  @ApiProperty({ description: 'Estimated benchmark proficiency tier' })
  benchmarkLevel!: string;

  @ApiProperty({ description: 'Competency summary description' })
  description!: string;
}
