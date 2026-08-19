import { Injectable, Logger } from '@nestjs/common';
import {
  AiProvider,
  QuestionPromptContext,
  EvaluationPromptContext,
  LearningPathPromptContext,
  AiExecutionResult,
} from '../interfaces/ai-provider.interface';
import {
  GeneratedQuestionAi,
  EvaluatedAnswerAi,
  GeneratedLearningPathAi,
  DifficultyLevel,
} from '@ai-interview/contracts';

@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockAiProvider.name);

  async generateQuestion(
    context: QuestionPromptContext,
  ): Promise<AiExecutionResult<GeneratedQuestionAi>> {
    const startTime = Date.now();
    const primaryTech = context.technologies[0] || 'General Software Engineering';

    const questionsByTurn: Record<
      number,
      { content: string; keyFocus: string; expected: string[] }
    > = {
      1: {
        content: `In a production ${primaryTech} application, how do you handle state management, lifecycle events, and error boundaries effectively? Describe a real-world scenario where a mismanaged state caused a bug.`,
        keyFocus: `${primaryTech} Core Architecture & State Management`,
        expected: [
          'State isolation',
          'Predictable data flow',
          'Error boundary strategies',
          'Graceful UI recovery',
        ],
      },
      2: {
        content: `When designing high-throughput API endpoints with ${context.technologies.slice(0, 2).join(' & ')}, how would you mitigate race conditions and ensure data consistency under heavy concurrent load?`,
        keyFocus: 'Concurrency, Transactions & Data Consistency',
        expected: [
          'Optimistic/Pessimistic locking',
          'Database isolation levels',
          'Idempotency patterns',
          'Cache invalidation',
        ],
      },
      3: {
        content: `Explain your approach to diagnosing and resolving a sudden 500ms latency spike in an API endpoint connected to a PostgreSQL database. What tools and metrics do you inspect first?`,
        keyFocus: 'Performance Optimization & Database Query Profiling',
        expected: [
          'Query execution plan (EXPLAIN ANALYZE)',
          'Connection pooling saturation',
          'Index utilization',
          'N+1 query detection',
        ],
      },
      4: {
        content: `How would you architect an asynchronous background job processing system using Redis and BullMQ to guarantee at-least-once processing without causing memory bloat or deadlocks?`,
        keyFocus: 'Distributed Queuing & Asynchronous Processing',
        expected: [
          'Idempotent job handlers',
          'Retry backoff strategies',
          'Dead letter queues',
          'Job retention policies',
        ],
      },
      5: {
        content: `As a ${context.level} ${context.role}, how do you evaluate architectural trade-offs between a Modular Monolith and Microservices for a rapidly growing startup team?`,
        keyFocus: 'System Architecture & Engineering Trade-offs',
        expected: [
          'Domain boundaries (Bounded Contexts)',
          'Operational complexity',
          'Team topology',
          'Deployment decoupling vs shared data consistency',
        ],
      },
    };

    const selected = questionsByTurn[context.turnNumber] || {
      content: `Explain key security practices you apply when building production services in ${primaryTech}.`,
      keyFocus: 'Security Best Practices & Vulnerability Mitigation',
      expected: [
        'Input sanitization',
        'Token rotation',
        'Principle of least privilege',
        'OWASP Top 10 defenses',
      ],
    };

    const questionData: GeneratedQuestionAi = {
      content: selected.content,
      keyFocus: selected.keyFocus,
      expectedKeyPoints: selected.expected,
      suggestedDifficulty: context.difficulty as DifficultyLevel,
    };

    const latencyMs = Date.now() - startTime + 50; // fast & deterministic

    return {
      data: questionData,
      model: 'mock-gpt-4o',
      provider: 'mock',
      promptTokens: 180,
      completionTokens: 90,
      totalTokens: 270,
      latencyMs,
      costEstimate: 0.0,
    };
  }

  async evaluateAnswer(
    context: EvaluationPromptContext,
  ): Promise<AiExecutionResult<EvaluatedAnswerAi>> {
    const startTime = Date.now();
    const answerLength = context.answer.trim().length;

    let score = 8.5;
    let technicalAccuracy = 8.5;
    let depth = 8.0;
    let clarity = 9.0;

    if (answerLength < 80) {
      score = 4.5;
      technicalAccuracy = 5.0;
      depth = 4.0;
      clarity = 5.5;
    } else if (answerLength < 250) {
      score = 7.0;
      technicalAccuracy = 7.0;
      depth = 6.5;
      clarity = 7.5;
    } else if (answerLength > 600) {
      score = 9.2;
      technicalAccuracy = 9.5;
      depth = 9.0;
      clarity = 9.0;
    }

    const evaluationData: EvaluatedAnswerAi = {
      score,
      rubricScores: {
        technicalAccuracy,
        depth,
        clarity,
      },
      strengths: [
        'Directly addressed the core question prompt with relevant terminology',
        'Demonstrated practical awareness of architectural trade-offs',
        'Structured the explanation clearly with logical progression',
      ],
      improvements: [
        'Could include more concrete code-level examples or telemetry metrics',
        'Consider elaborating on edge cases and failure recovery mechanisms',
      ],
      conciseFeedback: `Solid answer suitable for a ${context.level} level. Good grasp of fundamental principles and practical applications.`,
      evidence: [
        context.answer.length > 50
          ? `"${context.answer.substring(0, 60)}..."`
          : `"${context.answer}"`,
      ],
    };

    const latencyMs = Date.now() - startTime + 60;

    return {
      data: evaluationData,
      model: 'mock-gpt-4o',
      provider: 'mock',
      promptTokens: 240,
      completionTokens: 130,
      totalTokens: 370,
      latencyMs,
      costEstimate: 0.0,
    };
  }

  async generateLearningPath(
    context: LearningPathPromptContext,
  ): Promise<AiExecutionResult<GeneratedLearningPathAi>> {
    const startTime = Date.now();

    const learningPathData: GeneratedLearningPathAi = {
      summary: `Tailored technical improvement roadmap for ${context.level} ${context.role} candidate with an overall performance score of ${context.overallScore.toFixed(1)}/10.`,
      items: [
        {
          gap: 'Deep understanding of distributed transactions & lock management',
          topic: 'Database Concurrency & Isolation Levels',
          priority: 'HIGH',
          recommendedAction:
            'Study PostgreSQL MVCC, row-level locking (SELECT FOR UPDATE), and isolation anomaly prevention.',
          searchKeywords: [
            'PostgreSQL MVCC',
            'Serializable isolation',
            'Distributed lock patterns with Redis',
          ],
        },
        {
          gap: 'System observability & latency bottleneck profiling',
          topic: 'APM Profiling & Query Optimization',
          priority: 'MEDIUM',
          recommendedAction:
            'Practice analyzing PostgreSQL EXPLAIN ANALYZE outputs and configuring OpenTelemetry trace spans.',
          searchKeywords: [
            'PostgreSQL query planner indexing',
            'OpenTelemetry distributed tracing',
            'NestJS APM metrics',
          ],
        },
        {
          gap: 'Resilience patterns in async queue workers',
          topic: 'Idempotent Message Processing & Dead Letter Queues',
          priority: 'MEDIUM',
          recommendedAction:
            'Implement exponential backoff with jitter and transactional outbox patterns for reliable messaging.',
          searchKeywords: [
            'BullMQ idempotency pattern',
            'Transactional outbox pattern NestJS',
            'Dead letter queue recovery',
          ],
        },
      ],
    };

    const latencyMs = Date.now() - startTime + 80;

    return {
      data: learningPathData,
      model: 'mock-gpt-4o',
      provider: 'mock',
      promptTokens: 400,
      completionTokens: 220,
      totalTokens: 620,
      latencyMs,
      costEstimate: 0.0,
    };
  }
}
