import { Injectable } from '@nestjs/common';
import { GapAnalysisResponseDto, GapAnalysisItemDto } from '@ai-interview/contracts';
import { SkillAggregationService } from './skill-aggregation.service';

@Injectable()
export class GapAnalysisService {
  constructor(private readonly skillAggregationService: SkillAggregationService) {}

  /**
   * Analyze gaps for candidate against target role
   */
  async analyzeGaps(
    userId: string,
    roleTitle: string = 'Senior Backend Engineer',
    seniorityLevel: string = 'Senior'
  ): Promise<GapAnalysisResponseDto> {
    const graph = await this.skillAggregationService.getCandidateSkillGraph(userId);
    const targetScore = seniorityLevel.toLowerCase().includes('senior') ? 8.0 : 7.0;

    const gapItems: GapAnalysisItemDto[] = [];

    for (const area of graph.areas) {
      for (const sub of area.subCompetencies) {
        const currentScore = sub.score;
        const gapScore = Number(Math.max(0, targetScore - currentScore).toFixed(2));
        if (gapScore > 0 || currentScore < 7.0) {
          const priority: 'HIGH' | 'MEDIUM' | 'LOW' =
            gapScore >= 2.5 ? 'HIGH' : gapScore >= 1.2 ? 'MEDIUM' : 'LOW';

          gapItems.push({
            skillNodeId: sub.id,
            name: sub.name,
            competencyArea: area.area,
            currentScore,
            targetScore,
            gapScore,
            priority,
            recommendation: `Improve ${sub.name} by practicing real-world distributed trade-offs.`,
            suggestedAction: `Start a Focused Remediation session in ${area.name}.`,
          });
        }
      }
    }

    // Sort by gap descending and take top 5
    gapItems.sort((a, b) => b.gapScore - a.gapScore);
    const topGaps = gapItems.slice(0, 5);

    return {
      roleTitle,
      seniorityLevel,
      topGaps,
    };
  }
}
