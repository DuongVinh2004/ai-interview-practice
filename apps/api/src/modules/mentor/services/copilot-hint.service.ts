import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CompetencyArea } from '@ai-interview/contracts';

export interface ProbingHint {
  id: string;
  competencyArea: CompetencyArea;
  topic: string;
  questionText: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  intentDescription: string;
  expectedKeySignals: string[];
}

@Injectable()
export class CopilotHintService {
  constructor(private readonly prisma: PrismaService) {}

  async getProbingHints(
    sessionId: string,
    topic?: string,
    userId?: string,
  ): Promise<{ sessionId: string; currentTurnTopic: string; hints: ProbingHint[] }> {
    if (userId) {
      const liveSession = await this.prisma.liveSession.findUnique({
        where: { id: sessionId },
        include: { mentor: true },
      });

      if (liveSession) {
        if (liveSession.mentor.userId !== userId) {
          throw new ForbiddenException('Only the designated mentor can view co-pilot probing hints');
        }
      } else {
        const mentorProfile = await this.prisma.mentorProfile.findUnique({
          where: { userId },
        });
        if (!mentorProfile) {
          throw new ForbiddenException('Only registered mentors can access co-pilot hints');
        }
      }
    }

    // 1. Fetch any context from interview turns or live session
    const turns = await this.prisma.interviewTurn.findMany({
      where: { sessionId },
      include: { question: true, answer: { include: { evaluation: true } } },
      orderBy: { turnNumber: 'desc' },
      take: 1,
    });

    const activeTopic = topic || turns[0]?.question?.keyFocus || 'System Scalability & Resiliency';

    const hints: ProbingHint[] = [
      {
        id: 'hint-1',
        competencyArea: CompetencyArea.SYSTEM_DESIGN,
        topic: activeTopic,
        questionText: `Could you walk me through how your design handles a sudden 10x traffic surge? Specifically, where are the bottlenecks in write throughput?`,
        difficulty: 'HARD',
        intentDescription: 'Tests candidate understanding of write amplification, message queue buffering, and database sharding.',
        expectedKeySignals: [
          'Mention of asynchronous ingestion (Kafka/RabbitMQ)',
          'Rate limiting / token bucket algorithm',
          'Read/write splitting or DB horizontal partitioning',
        ],
      },
      {
        id: 'hint-2',
        competencyArea: CompetencyArea.DATABASE_CONCURRENCY,
        topic: activeTopic,
        questionText: `What isolation level would you configure for this transaction, and how would you prevent phantom reads or double booking?`,
        difficulty: 'MEDIUM',
        intentDescription: 'Evaluates ACID trade-offs, pessimistic vs optimistic locking, and distributed transaction pitfalls.',
        expectedKeySignals: [
          'SERIALIZABLE or REPEATABLE READ isolation',
          'Optimistic locking with version column / condition check',
          'Distributed locks (e.g., Redis Redlock) with TTL',
        ],
      },
      {
        id: 'hint-3',
        competencyArea: CompetencyArea.RESILIENCE_SECURITY,
        topic: activeTopic,
        questionText: `If the downstream third-party payment gateway starts timing out at 50% rate, how does your service degrade gracefully without cascading failures?`,
        difficulty: 'MEDIUM',
        intentDescription: 'Probes circuit breaker mechanics, fallbacks, and bulkhead thread pools.',
        expectedKeySignals: [
          'Circuit Breaker pattern with half-open recovery state',
          'Expedited fallbacks & user queuing',
          'Dead letter queues for asynchronous retry reconciliation',
        ],
      },
      {
        id: 'hint-4',
        competencyArea: CompetencyArea.ARCHITECTURE_PATTERNS,
        topic: activeTopic,
        questionText: `How would you evolve this architecture from a monolith to event-driven microservices without experiencing data consistency issues across domain boundaries?`,
        difficulty: 'HARD',
        intentDescription: 'Assesses domain-driven design, Outbox pattern, and eventual consistency strategies.',
        expectedKeySignals: [
          'Transactional Outbox pattern with Debezium/CDC',
          'Saga pattern (choreographed vs orchestrated)',
          'Idempotent event consumers with deduplication keys',
        ],
      },
    ];

    return {
      sessionId,
      currentTurnTopic: activeTopic,
      hints,
    };
  }
}
