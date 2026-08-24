import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import {
  ErrorCode,
  AnalyzeStarResponse,
  StarEvaluationReport,
} from '@ai-interview/contracts';
import { StarRubric } from '../../evaluation/rubrics/star-rubric';

export interface AnalyzeStarInput {
  sessionId: string;
  turnNumber: number;
  questionText: string;
  candidateAnswer: string;
  competencyArea?: string;
}

@Injectable()
export class BehavioralService {
  private readonly logger = new Logger(BehavioralService.name);

  constructor(private readonly prisma: PrismaService) {}

  async analyzeStar(input: AnalyzeStarInput): Promise<AnalyzeStarResponse> {
    const { candidateAnswer } = input;
    const { extracted } = StarRubric.evaluate(candidateAnswer);

    const hasSituation = !extracted.missingComponents.includes('situation');
    const hasTask = !extracted.missingComponents.includes('task');
    const hasAction = !extracted.missingComponents.includes('action');
    const hasResult = !extracted.missingComponents.includes('result');

    let actionNeeded: 'PROBE' | 'COMPLETE' = 'COMPLETE';
    let probeText: string | null = null;
    let probeTextVi: string | null = null;

    if (!hasResult) {
      actionNeeded = 'PROBE';
      probeText = 'You described the actions well, but what were the quantifiable business or engineering results of this initiative?';
      probeTextVi = 'Bạn đã mô tả hành động rất tốt, nhưng kết quả định lượng cụ thể (chỉ số, phần trăm cải thiện) của dự án này là gì?';
    } else if (!hasAction) {
      actionNeeded = 'PROBE';
      probeText = 'Could you elaborate on the specific individual actions and technical decisions you personally took to resolve this challenge?';
      probeTextVi = 'Bạn có thể chia sẻ sâu hơn về những hành động và quyết định kỹ thuật cụ thể mà cá nhân bạn đã thực hiện không?';
    } else if (!hasTask) {
      actionNeeded = 'PROBE';
      probeText = 'What was your exact role and objective when this challenge emerged?';
      probeTextVi = 'Mục tiêu và trách nhiệm cụ thể của bạn trong tình huống đó là gì?';
    }

    return {
      starIdentified: {
        situation: hasSituation,
        task: hasTask,
        action: hasAction,
        result: hasResult,
      },
      actionNeeded,
      missingComponents: extracted.missingComponents,
      probeText,
      probeTextVi,
      annotatedSegments: {
        situation: extracted.situationText,
        task: extracted.taskText,
        action: extracted.actionText,
        result: extracted.resultText,
      },
    };
  }

  async getStarEvaluationReport(answerId: string): Promise<StarEvaluationReport> {
    const starEval = await this.prisma.starEvaluation.findUnique({
      where: { answerId },
    });

    if (!starEval) {
      // Fallback: compute on-the-fly from Answer content if evaluation is pending
      const answer = await this.prisma.answer.findUnique({
        where: { id: answerId },
      });

      if (!answer) {
        throw new DomainException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Answer not found for STAR report',
          HttpStatus.NOT_FOUND,
        );
      }

      const evaluated = StarRubric.evaluate(answer.content);
      return {
        id: 'temp-star-report',
        answerId,
        situationText: evaluated.extracted.situationText,
        taskText: evaluated.extracted.taskText,
        actionText: evaluated.extracted.actionText,
        resultText: evaluated.extracted.resultText,
        scores: evaluated.scores,
        conciseFeedback: evaluated.feedback,
        probingQuestionsAsked: [],
        strengths: evaluated.strengths,
        improvements: evaluated.improvements,
        createdAt: new Date().toISOString(),
      };
    }

    const evaluated = StarRubric.evaluate(
      (starEval.situationText || '') + ' ' + (starEval.actionText || '') + ' ' + (starEval.resultText || ''),
    );

    return {
      id: starEval.id,
      answerId: starEval.answerId,
      situationText: starEval.situationText,
      taskText: starEval.taskText,
      actionText: starEval.actionText,
      resultText: starEval.resultText,
      scores: {
        situationScore: starEval.situationScore,
        taskScore: starEval.taskScore,
        actionScore: starEval.actionScore,
        resultScore: starEval.resultScore,
        structureScore: starEval.structureScore,
        totalScore: starEval.totalScore,
      },
      conciseFeedback: starEval.feedback,
      probingQuestionsAsked: (starEval.probingQuestionsAsked as string[]) || [],
      strengths: evaluated.strengths,
      improvements: evaluated.improvements,
      createdAt: starEval.createdAt.toISOString(),
    };
  }

  async listCompetencies() {
    return this.prisma.behavioralCompetency.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        questions: {
          select: {
            id: true,
            companyPreset: true,
            templateText: true,
            templateTextVi: true,
            difficulty: true,
          },
        },
      },
    });
  }
}
