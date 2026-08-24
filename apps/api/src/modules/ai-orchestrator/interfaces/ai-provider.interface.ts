import {
  GeneratedQuestionAi,
  EvaluatedAnswerAi,
  GeneratedLearningPathAi,
} from '@ai-interview/contracts';

export interface QuestionPromptContext {
  role: string;
  level: string;
  technologies: string[];
  turnNumber: number;
  difficulty: number;
  previousScore?: number;
  competencyArea?: string;
  sessionMode?: string;
}

export interface EvaluationPromptContext {
  role: string;
  level: string;
  question: string;
  keyFocus?: string;
  expectedPoints?: string[];
  answer: string;
}

export interface LearningPathPromptContext {
  role: string;
  level: string;
  turns: Array<{
    turnNumber: number;
    question: string;
    answer: string;
    score: number;
    strengths: string[];
    improvements: string[];
  }>;
  overallScore: number;
}

export interface AiExecutionResult<T> {
  data: T;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  costEstimate?: number;
}

export interface AiProvider {
  readonly name: string;
  generateQuestion(
    context: QuestionPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<GeneratedQuestionAi>>;

  evaluateAnswer(
    context: EvaluationPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<EvaluatedAnswerAi>>;

  generateLearningPath(
    context: LearningPathPromptContext,
    systemPrompt: string,
    userPrompt?: string,
  ): Promise<AiExecutionResult<GeneratedLearningPathAi>>;
}
