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
  language?: string;
}

export interface EvaluationPromptContext {
  role: string;
  level: string;
  question: string;
  keyFocus?: string;
  expectedPoints?: string[];
  answer: string;
  language?: string;
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
  language?: string;
}

export interface SocraticChatContext {
  role: string;
  level: string;
  question: string;
  originalAnswer: string;
  score: number;
  strengths: string[];
  improvements: string[];
  keyFocus?: string;
  userMessage: string;
  chatHistory: Array<{ role: 'USER' | 'AI_TUTOR' | 'user' | 'assistant'; content: string }>;
  language?: string;
}

export interface SocraticChatResult {
  fullText: string;
  references?: Array<{ title: string; url: string }>;
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

  streamSocraticChat?(
    context: SocraticChatContext,
    systemPrompt: string,
    onToken?: (token: string) => void,
  ): Promise<AiExecutionResult<SocraticChatResult>>;
}
