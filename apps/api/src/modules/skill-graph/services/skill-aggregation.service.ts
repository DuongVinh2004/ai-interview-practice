import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CompetencyArea, SkillGraphResponseDto, SkillGraphNodeDto } from '@ai-interview/contracts';

export interface ScoreEvidence {
  score: number;
  evaluatedAt: Date;
}

@Injectable()
export class SkillAggregationService {
  private readonly logger = new Logger(SkillAggregationService.name);
  public static readonly DEFAULT_LAMBDA = 0.01; // Decay parameter per day

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate exponential decay weighted score:
   * S_weighted = sum(s_i * exp(-lambda * delta_t_i)) / sum(exp(-lambda * delta_t_i))
   * @param evidences List of score observations with timestamps
   * @param lambda Decay rate per day (default 0.01)
   * @param referenceDate Reference date (default now)
   */
  public calculateExponentialDecayScore(
    evidences: ScoreEvidence[],
    lambda: number = SkillAggregationService.DEFAULT_LAMBDA,
    referenceDate: Date = new Date(),
  ): number {
    if (!evidences || evidences.length === 0) {
      return 0.0;
    }

    let weightedSum = 0;
    let weightSum = 0;

    for (const evidence of evidences) {
      const deltaMs = Math.max(
        0,
        referenceDate.getTime() - new Date(evidence.evaluatedAt).getTime(),
      );
      const deltaDays = deltaMs / (1000 * 60 * 60 * 24);
      const weight = Math.exp(-lambda * deltaDays);

      weightedSum += evidence.score * weight;
      weightSum += weight;
    }

    if (weightSum === 0) return 0.0;
    const finalScore = weightedSum / weightSum;
    return Number(Math.min(10.0, Math.max(0.0, finalScore)).toFixed(2));
  }

  /**
   * Get candidate full 3-tier skill graph
   */
  async getCandidateSkillGraph(userId: string): Promise<SkillGraphResponseDto> {
    // 1. Fetch all skill nodes
    let nodes = await this.prisma.skillNode.findMany({
      where: { isActive: true },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    });

    // If no nodes exist yet in DB, ensure baseline seed taxonomy
    if (nodes.length === 0) {
      await this.seedDefaultSkillNodes();
      nodes = await this.prisma.skillNode.findMany({
        where: { isActive: true },
        orderBy: [{ level: 'asc' }, { order: 'asc' }],
      });
    }

    // 2. Fetch candidate skill scores
    const skillScores = await this.prisma.skillScore.findMany({
      where: { userId },
    });
    const scoreMap = new Map(skillScores.map(s => [s.skillNodeId, s]));

    // 3. Fetch candidate's completed interview turns for evidence fallback
    const interviewTurns = await this.prisma.interviewTurn.findMany({
      where: {
        session: { userId },
        answer: {
          evaluation: {
            is: { authorityState: 'AUTHORITATIVE', needsReview: false },
          },
        },
      },
      include: {
        answer: { include: { evaluation: true } },
        session: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group turns by competency area
    const areaTurnMap = new Map<CompetencyArea, ScoreEvidence[]>();
    for (const turn of interviewTurns) {
      const rawArea = turn.session.competencyArea;
      const area = rawArea ? (rawArea as unknown as CompetencyArea) : CompetencyArea.SYSTEM_DESIGN;
      if (!areaTurnMap.has(area)) {
        areaTurnMap.set(area, []);
      }
      if (turn.answer?.evaluation?.score != null) {
        areaTurnMap.get(area)!.push({
          score: turn.answer.evaluation.score,
          evaluatedAt: turn.answer.evaluation.createdAt,
        });
      }
    }

    // 4. Build hierarchy: Area -> SubCompetency -> Topic
    const level1Nodes = nodes.filter(n => n.level === 1);
    const level2Nodes = nodes.filter(n => n.level === 2);
    const level3Nodes = nodes.filter(n => n.level === 3);

    const areas = level1Nodes.map(areaNode => {
      const areaEnum = areaNode.competencyArea
        ? (areaNode.competencyArea as unknown as CompetencyArea)
        : CompetencyArea.SYSTEM_DESIGN;
      const subNodes = level2Nodes.filter(
        sub => sub.parentId === areaNode.id || sub.competencyArea === (areaEnum as any),
      );

      const subCompetencies: SkillGraphNodeDto[] = subNodes.map(subNode => {
        const topics = level3Nodes.filter(topic => topic.parentId === subNode.id);
        const subScoreRec = scoreMap.get(subNode.id);

        const childDtos: SkillGraphNodeDto[] = topics.map(topicNode => {
          const topicScoreRec = scoreMap.get(topicNode.id);
          const topicScore = topicScoreRec?.weightedScore || 0;
          const topicArea = topicNode.competencyArea
            ? (topicNode.competencyArea as unknown as CompetencyArea)
            : areaEnum;
          return {
            id: topicNode.id,
            name: topicNode.name,
            nameVi: topicNode.nameVi,
            slug: topicNode.slug,
            level: topicNode.level,
            competencyArea: topicArea,
            score: topicScore,
            rawScore: topicScoreRec?.rawScore || topicScore,
            evidenceCount: topicScoreRec?.evidenceCount || (topicScore > 0 ? 1 : 0),
            benchmarkP50: 7.2,
            percentile: topicScore > 0 ? Math.min(99, Math.round(topicScore * 10)) : 50,
          };
        });

        // Compute sub-competency score
        let subScore = subScoreRec?.weightedScore || 0;
        if (subScore === 0 && childDtos.length > 0) {
          const validChildren = childDtos.filter(c => c.score > 0);
          if (validChildren.length > 0) {
            subScore = validChildren.reduce((acc, c) => acc + c.score, 0) / validChildren.length;
          }
        }
        if (subScore === 0) {
          const evidences = areaTurnMap.get(areaEnum) || [];
          if (evidences.length > 0) {
            subScore = this.calculateExponentialDecayScore(evidences);
          }
        }

        const subArea = subNode.competencyArea
          ? (subNode.competencyArea as unknown as CompetencyArea)
          : areaEnum;
        return {
          id: subNode.id,
          name: subNode.name,
          nameVi: subNode.nameVi,
          slug: subNode.slug,
          level: subNode.level,
          competencyArea: subArea,
          score: Number(subScore.toFixed(2)),
          rawScore: subScoreRec?.rawScore || Number(subScore.toFixed(2)),
          evidenceCount: subScoreRec?.evidenceCount || (subScore > 0 ? 3 : 0),
          benchmarkP50: 7.0,
          percentile: subScore > 0 ? Math.min(99, Math.round(subScore * 10)) : 50,
          children: childDtos,
        };
      });

      // Compute area overall score
      let areaScore = 0;
      const validSubs = subCompetencies.filter(s => s.score > 0);
      if (validSubs.length > 0) {
        areaScore = validSubs.reduce((acc, s) => acc + s.score, 0) / validSubs.length;
      } else {
        const evidences = areaTurnMap.get(areaEnum) || [];
        areaScore = this.calculateExponentialDecayScore(evidences);
      }

      return {
        area: areaEnum,
        name: areaNode.name,
        score: Number(areaScore.toFixed(2)),
        benchmarkP50: 7.2,
        percentile: areaScore > 0 ? Math.min(99, Math.round(areaScore * 10)) : 50,
        subCompetencies,
      };
    });

    const activeAreas = areas.filter(a => a.score > 0);
    const overallScore =
      activeAreas.length > 0
        ? Number((activeAreas.reduce((sum, a) => sum + a.score, 0) / activeAreas.length).toFixed(2))
        : 0.0;

    return {
      userId,
      overallScore,
      areas,
      lastUpdated: new Date().toISOString(),
    };
  }

  private seedingPromise: Promise<void> | null = null;

  /**
   * Seed default 5 Areas x 4 Sub-Competencies = 20 root skill nodes if taxonomy empty
   */
  async seedDefaultSkillNodes(): Promise<void> {
    if (this.seedingPromise) {
      return this.seedingPromise;
    }
    this.seedingPromise = this.executeSeedDefaultSkillNodes().finally(() => {
      this.seedingPromise = null;
    });
    return this.seedingPromise;
  }

  private async executeSeedDefaultSkillNodes(): Promise<void> {
    const areas = [
      {
        area: CompetencyArea.SYSTEM_DESIGN,
        name: 'System Design & Scalability',
        nameVi: 'Thiết kế Hệ thống & Mở rộng',
        slug: 'system-design',
      },
      {
        area: CompetencyArea.LANGUAGE_CORE,
        name: 'Language & Framework Core',
        nameVi: 'Ngôn ngữ Lập trình & Nền tảng',
        slug: 'language-core',
      },
      {
        area: CompetencyArea.DATABASE_CONCURRENCY,
        name: 'Database & Concurrency',
        nameVi: 'Cơ sở Dữ liệu & Đa luồng',
        slug: 'database-concurrency',
      },
      {
        area: CompetencyArea.ARCHITECTURE_PATTERNS,
        name: 'Architecture & Design Patterns',
        nameVi: 'Mô hình Kiến trúc & Mẫu Thiết kế',
        slug: 'architecture-patterns',
      },
      {
        area: CompetencyArea.RESILIENCE_SECURITY,
        name: 'Resilience & Security',
        nameVi: 'Bảo mật & Tính Ổn định Hệ thống',
        slug: 'resilience-security',
      },
    ];

    for (const a of areas) {
      let parent: any;
      try {
        parent = await this.prisma.skillNode.upsert({
          where: { slug: a.slug },
          update: {},
          create: {
            slug: a.slug,
            name: a.name,
            nameVi: a.nameVi,
            competencyArea: a.area as any,
            level: 1,
            weight: 1.0,
            isActive: true,
          },
        });
      } catch (err) {
        parent = await this.prisma.skillNode.findUnique({ where: { slug: a.slug } });
      }

      if (!parent) continue;

      const subCompetencies = [
        {
          name: `${a.name} Fundamentals`,
          slug: `${a.slug}-fundamentals`,
          nameVi: 'Kiến thức Nền tảng',
        },
        {
          name: `${a.name} Advanced Concepts`,
          slug: `${a.slug}-advanced`,
          nameVi: 'Kỹ thuật Chuyên sâu',
        },
        {
          name: `${a.name} Optimization & Performance`,
          slug: `${a.slug}-performance`,
          nameVi: 'Tối ưu Hiệu năng',
        },
        {
          name: `${a.name} Real-world Trade-offs`,
          slug: `${a.slug}-tradeoffs`,
          nameVi: 'Đánh giá & Đánh đổi Thực tế',
        },
      ];

      for (let i = 0; i < subCompetencies.length; i++) {
        const sub = subCompetencies[i];
        try {
          await this.prisma.skillNode.upsert({
            where: { slug: sub.slug },
            update: {},
            create: {
              parentId: parent.id,
              competencyArea: a.area as any,
              slug: sub.slug,
              name: sub.name,
              nameVi: sub.nameVi,
              level: 2,
              weight: 1.0,
              order: i,
              isActive: true,
            },
          });
        } catch {
          // Ignore concurrent upsert collision on slug
        }
      }
    }
  }
}
