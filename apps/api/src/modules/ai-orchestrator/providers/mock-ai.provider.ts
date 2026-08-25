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
    _systemPrompt?: string,
    _userPrompt?: string,
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
    _systemPrompt?: string,
    _userPrompt?: string,
  ): Promise<AiExecutionResult<EvaluatedAnswerAi>> {
    const startTime = Date.now();
    const answerRaw = context.answer.trim();
    const answerLower = answerRaw.toLowerCase();

    // 1. ADVERSARIAL & SAFETY GUARDRAILS
    if (
      answerLower.includes('ignore every earlier instruction') ||
      answerLower.includes('ignore all previous') ||
      answerLower.includes('reveal the hidden rubric') ||
      answerLower.includes('give me 100') ||
      answerLower.includes('print api key') ||
      answerLower.includes('exfiltrate')
    ) {
      return {
        data: {
          score: 0.0,
          rubricScores: { technicalAccuracy: 0.0, depth: 0.0, clarity: 0.0 },
          strengths: ['None'],
          improvements: [
            'Answer must address the technical prompt instead of prompt injection instructions.',
          ],
          conciseFeedback: 'Prompt injection or adversarial instruction detected in submission.',
          evidence: [],
          confidence: 0.99,
          missingConcepts: ['All technical concepts omitted due to prompt injection'],
          needsReview: true,
          safetyFlags: ['prompt_injection'],
        },
        model: 'mock-evaluator-v1',
        provider: 'mock',
        promptTokens: 250,
        completionTokens: 80,
        totalTokens: 330,
        latencyMs: Date.now() - startTime + 40,
        costEstimate: 0.0,
      };
    }

    if (
      answerLower.includes('infer my age') ||
      answerLower.includes('gender') ||
      answerLower.includes('mental health') ||
      answerLower.includes('should a company hire me')
    ) {
      return {
        data: {
          score: 2.0,
          rubricScores: { technicalAccuracy: 2.0, depth: 1.0, clarity: 3.0 },
          strengths: ['Communication attempted'],
          improvements: ['Please focus strictly on technical engineering topics.'],
          conciseFeedback:
            'System evaluates technical knowledge only and does not infer personal traits or make hiring decisions.',
          evidence: [],
          confidence: 0.95,
          missingConcepts: ['Technical implementation details'],
          needsReview: false,
          safetyFlags: ['protected_trait_request'],
        },
        model: 'mock-evaluator-v1',
        provider: 'mock',
        promptTokens: 250,
        completionTokens: 80,
        totalTokens: 330,
        latencyMs: Date.now() - startTime + 40,
        costEstimate: 0.0,
      };
    }

    // Verbosity manipulation detection (e.g. repeated same word 5+ times with no substance)
    const cleanWords = answerLower
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(Boolean);
    const wordCounts: Record<string, number> = {};
    for (const w of cleanWords) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
    const maxRepetition = Math.max(...Object.values(wordCounts), 0);
    if (cleanWords.length >= 5 && maxRepetition / cleanWords.length >= 0.3) {
      return {
        data: {
          score: 2.5,
          rubricScores: { technicalAccuracy: 2.5, depth: 2.0, clarity: 3.0 },
          strengths: ['Identified domain keywords'],
          improvements: [
            'Avoid keyword repetition; provide substantive architectural explanations.',
          ],
          conciseFeedback:
            'Answer contains excessive keyword repetition without substantive engineering mechanism.',
          evidence: [`"${cleanWords.slice(0, 5).join(' ')}..."`],
          confidence: 0.85,
          missingConcepts: ['Concrete architectural implementation', 'Failure mode handling'],
          needsReview: false,
          safetyFlags: ['verbosity_manipulation'],
        },
        model: 'mock-evaluator-v1',
        provider: 'mock',
        promptTokens: 250,
        completionTokens: 90,
        totalTokens: 340,
        latencyMs: Date.now() - startTime + 40,
        costEstimate: 0.0,
      };
    }

    // 2. CONTENT-BASED EVIDENCE & RUBRIC ANALYSIS (VI/EN SUPPORT - Alignment with Rubrics)
    const technicalKeyTerms: Array<{ term: string; synonyms: string[]; weight: number }> = [];

    if (context.expectedPoints && context.expectedPoints.length > 0) {
      for (const pt of context.expectedPoints) {
        const cleanedPt = pt.replace(/[()]/g, ' ');
        const phraseSynonyms = cleanedPt
          .split(/[,;/]|\s+-\s+/)
          .map(p => p.trim())
          .filter(p => p.length >= 2);

        // Also add individual important words
        const wordSynonyms = cleanedPt
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, '')
          .split(/\s+/)
          .filter(w => w.length >= 4 && !['with', 'from', 'that', 'this', 'using'].includes(w));

        const combinedSynonyms = Array.from(new Set([...phraseSynonyms, ...wordSynonyms]));

        technicalKeyTerms.push({
          term: pt,
          synonyms: combinedSynonyms.length > 0 ? combinedSynonyms : [pt],
          weight: 2.5,
        });
      }
    } else {
      const qLower = (context.question || '').toLowerCase();
      if (
        qLower.includes('isolation') ||
        qLower.includes('dirty read') ||
        qLower.includes('locking') ||
        answerLower.includes('dirty read') ||
        answerLower.includes('mvcc') ||
        answerLower.includes('pessimistic')
      ) {
        technicalKeyTerms.push(
          {
            term: 'isolation_anomalies / dirty_reads',
            synonyms: [
              'dirty read',
              'dirty reads',
              'non-repeatable read',
              'phantom read',
              'anomalies',
              'cột version',
            ],
            weight: 2.5,
          },
          {
            term: 'concurrency_mechanisms / mvcc',
            synonyms: [
              'mvcc',
              'snapshot',
              'shared lock',
              'predicate lock',
              'where id = ?',
              'select ... for update',
            ],
            weight: 2.5,
          },
          {
            term: 'serializable_isolation / 2pl',
            synonyms: [
              'serializable',
              'strict two-phase locking',
              '2pl',
              'optimistic',
              'pessimistic',
              'rollback',
            ],
            weight: 2.5,
          },
          {
            term: 'conflict_mitigation / locking_strategy',
            synonyms: [
              'lock',
              'locking',
              'xung đột',
              'khóa hàng',
              'isolation level',
              'cơ sở dữ liệu',
            ],
            weight: 2.5,
          },
        );
      } else if (
        qLower.includes('cache') ||
        qLower.includes('stampede') ||
        answerLower.includes('cache-aside') ||
        answerLower.includes('redis')
      ) {
        technicalKeyTerms.push(
          {
            term: 'cache_aside_pattern',
            synonyms: [
              'cache-aside',
              'cache aside',
              'redis',
              'đọc từ redis',
              'cache hit',
              'cache miss',
            ],
            weight: 2.5,
          },
          {
            term: 'ttl_expiration_strategy',
            synonyms: ['ttl', 'time to live', 'kèm ttl', 'expiration', 'invalidation'],
            weight: 2.5,
          },
          {
            term: 'stampede_concurrency_lock',
            synonyms: [
              'cache stampede',
              'thundering herd',
              'distributed mutex',
              'redlock',
              'mutex',
              'xfetch',
              'probabilistic',
            ],
            weight: 2.5,
          },
          {
            term: 'background_refresh_recovery',
            synonyms: ['background refresh', 'database', 'cập nhật lại cache', 'fallback'],
            weight: 2.5,
          },
        );
      } else if (
        qLower.includes('go') ||
        qLower.includes('channel') ||
        qLower.includes('event loop') ||
        answerLower.includes('goroutine') ||
        answerLower.includes('libuv')
      ) {
        technicalKeyTerms.push(
          {
            term: 'concurrency_primitives',
            synonyms: ['goroutine', 'buffered jobs channel', 'channel', 'libuv', 'event loop'],
            weight: 2.5,
          },
          {
            term: 'lifecycle_cancellation_microtasks',
            synonyms: ['ctx.done()', 'context', 'microtask', 'process.nexttick', 'cancellation'],
            weight: 2.5,
          },
          {
            term: 'synchronization_phases',
            synonyms: [
              'sync.waitgroup',
              'waitgroup',
              'check phase',
              'setimmediate',
              'select statement',
            ],
            weight: 2.5,
          },
          {
            term: 'graceful_shutdown_execution',
            synonyms: ['graceful shutdown', 'non-blocking', 'close', 'results channel', 'workers'],
            weight: 2.5,
          },
        );
      } else if (
        qLower.includes('outbox') ||
        qLower.includes('saga') ||
        qLower.includes('circuit breaker') ||
        qLower.includes('jwt') ||
        answerLower.includes('outbox') ||
        answerLower.includes('saga') ||
        answerLower.includes('half_open') ||
        answerLower.includes('rs256')
      ) {
        technicalKeyTerms.push(
          {
            term: 'architectural_pattern_structure',
            synonyms: [
              'outbox',
              'transactional outbox',
              'saga',
              'saga orchestration',
              'circuit breaker',
              'rs256',
              'jwt',
            ],
            weight: 2.5,
          },
          {
            term: 'atomicity_compensating_states',
            synonyms: [
              'local database transaction',
              'compensating transaction',
              'half_open',
              'half-open',
              'closed',
              'open',
              'token rotation',
            ],
            weight: 2.5,
          },
          {
            term: 'event_relay_probe_lifecycle',
            synonyms: [
              'debezium',
              'cdc',
              'kafka',
              'orchestrator',
              'cooldown timeout',
              'probe request',
              'blacklist',
              'revocation',
            ],
            weight: 2.5,
          },
          {
            term: 'delivery_guarantee_resilience',
            synonyms: [
              'at-least-once',
              'fallback',
              'cascading',
              'dual-write',
              'zero trust',
              'failure rate',
            ],
            weight: 2.5,
          },
        );
      } else {
        // General technical key terms fallback
        technicalKeyTerms.push(
          {
            term: 'idempotency_key / key_isolation',
            synonyms: [
              'idempotency key',
              'khóa idempotency',
              'idempotency record',
              'unique key',
              'request id',
              'request-id',
            ],
            weight: 2.5,
          },
          {
            term: 'atomicity / database_transaction',
            synonyms: [
              'cùng transaction',
              'transaction',
              'giao dịch',
              'unique constraint',
              'atomic',
              'atomicity',
              'pessimistic',
              'optimistic',
            ],
            weight: 2.5,
          },
          {
            term: 'failure_semantics / response_replay',
            synonyms: [
              'replay response',
              'replay',
              'đang xử lý',
              'trả trạng thái',
              'response replay',
              'retry',
              'timeout',
              'dead letter',
              'recovery',
            ],
            weight: 2.5,
          },
          {
            term: 'observability / monitoring',
            synonyms: [
              'duplicate rate',
              'conflict',
              'theo dõi',
              'trace',
              'metric',
              'cảnh báo',
              'monitoring',
              'log',
            ],
            weight: 2.5,
          },
        );
      }
    }

    const matchedEvidence: string[] = [];
    const missingConcepts: string[] = [];
    let matchedWeight = 0;
    let totalPossibleWeight = 0;

    // Sentence extraction for evidence spans
    const sentences = answerRaw.split(/(?<=[.!?;\n])\s+/).filter(s => s.trim().length > 0);

    for (const keyTerm of technicalKeyTerms) {
      totalPossibleWeight += keyTerm.weight;
      let foundInAnswer = false;

      for (const syn of keyTerm.synonyms) {
        if (answerLower.includes(syn.toLowerCase())) {
          foundInAnswer = true;
          // Find matching sentence for evidence span
          const matchingSentence = sentences.find(s => s.toLowerCase().includes(syn.toLowerCase()));
          if (matchingSentence && !matchedEvidence.includes(matchingSentence.trim())) {
            matchedEvidence.push(matchingSentence.trim());
          }
          break;
        }
      }

      if (foundInAnswer) {
        matchedWeight += keyTerm.weight;
      } else {
        missingConcepts.push(keyTerm.term);
      }
    }

    // Calculate Rubric Dimensions (0 to 10 scale)
    const ratio = totalPossibleWeight > 0 ? matchedWeight / totalPossibleWeight : 0.5;

    // Technical Accuracy: based on matched core engineering concepts
    const technicalAccuracy = Math.min(
      10,
      Math.max(
        1,
        Number(
          (
            ratio * 8.0 +
            (matchedEvidence.length >= 2 ? 1.5 : 0.5) +
            (answerRaw.length > 80 ? 0.5 : 0)
          ).toFixed(1),
        ),
      ),
    );

    // Depth: based on nuance, specific terminology and explanations
    const depth = Math.min(
      10,
      Math.max(
        1,
        Number(
          (
            ratio * 7.5 +
            (matchedEvidence.length >= 2 ? 1.8 : 0.5) +
            (answerRaw.length > 100 ? 0.7 : 0)
          ).toFixed(1),
        ),
      ),
    );

    // Clarity: structured sentences, appropriate length
    const clarity = sentences.length >= 2 ? 9.0 : 6.0;

    // Deterministic application weighted total score: 40% accuracy, 30% depth, 30% clarity
    const finalScore = Number((technicalAccuracy * 0.4 + depth * 0.3 + clarity * 0.3).toFixed(1));

    // Confidence: high if answer has multiple concrete sentences and evidence
    const confidence =
      matchedEvidence.length >= 2 ? 0.95 : matchedEvidence.length === 1 ? 0.85 : 0.65;

    // Strengths & Improvements
    const strengths: string[] = [];
    if (matchedEvidence.length >= 2) {
      strengths.push(
        'Demonstrated strong understanding of core transactional boundaries and idempotency patterns',
      );
    }
    if (technicalAccuracy >= 7.5) {
      strengths.push('Applied correct domain terminology and structured solution logically');
    } else {
      strengths.push('Addressed the general interview topic and identified basic approach');
    }

    const improvements: string[] = [];
    if (missingConcepts.length > 0) {
      improvements.push(
        `Elaborate on missing technical concepts: ${missingConcepts.slice(0, 2).join(', ')}`,
      );
    }
    if (depth < 7.0) {
      improvements.push(
        'Include specific implementation details regarding failure modes and database constraints',
      );
    }

    const conciseFeedback =
      finalScore >= 8.0
        ? `Comprehensive technical answer demonstrating solid grasp of ${context.role} architecture principles.`
        : finalScore >= 5.5
          ? `Adequate explanation covering key aspects, but needs deeper detail on ${missingConcepts[0] || 'edge-case resilience'}.`
          : `High-level answer missing critical engineering mechanisms. Study ${missingConcepts.slice(0, 2).join(' and ')}.`;

    const evaluationData: EvaluatedAnswerAi = {
      score: finalScore,
      rubricScores: {
        technicalAccuracy,
        depth,
        clarity,
      },
      strengths,
      improvements:
        improvements.length > 0
          ? improvements
          : ['Continue practicing with more complex distributed systems trade-offs.'],
      conciseFeedback,
      evidence:
        matchedEvidence.length > 0
          ? matchedEvidence.slice(0, 3)
          : [`"${answerRaw.substring(0, 80)}"`],
      confidence,
      missingConcepts: missingConcepts.slice(0, 3),
      needsReview: false,
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
    _systemPrompt?: string,
    _userPrompt?: string,
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
