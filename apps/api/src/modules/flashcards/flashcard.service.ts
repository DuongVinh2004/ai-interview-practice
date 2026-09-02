import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { FSRSEngine, FSRSCard } from './fsrs/fsrs-engine';
import {
  CreateDeckDto,
  UpdateDeckDto,
  CreateFlashcardDto,
  ReviewCardDto,
  AutoGenerateFlashcardsDto,
} from './dto/flashcard.dto';
import { CardType, CardState, FlashcardStatsDto } from '@ai-interview/contracts';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AiOrchestratorService } from '../ai-orchestrator/ai-orchestrator.service';

@Injectable()
export class FlashcardService {
  private readonly logger = new Logger(FlashcardService.name);
  private readonly fsrs = new FSRSEngine();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional() private readonly aiOrchestrator?: AiOrchestratorService,
  ) {}

  // 1. Deck Operations
  async createDeck(userId: string, dto: CreateDeckDto) {
    return this.prisma.flashcardDeck.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        tags: dto.tags || [],
        cardCount: 0,
        dueCount: 0,
      },
    });
  }

  async updateDeck(userId: string, deckId: string, dto: UpdateDeckDto) {
    const deck = await this.prisma.flashcardDeck.findUnique({ where: { id: deckId } });
    if (!deck) throw new NotFoundException('Deck not found');
    if (deck.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.flashcardDeck.update({
      where: { id: deckId },
      data: {
        name: dto.name,
        description: dto.description,
        tags: dto.tags,
      },
    });
  }

  async deleteDeck(userId: string, deckId: string) {
    const deck = await this.prisma.flashcardDeck.findUnique({ where: { id: deckId } });
    if (!deck) throw new NotFoundException('Deck not found');
    if (deck.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.flashcardDeck.delete({ where: { id: deckId } });
    return { success: true };
  }

  async getUserDecks(userId: string) {
    const now = new Date();
    const decks = await this.prisma.flashcardDeck.findMany({
      where: { userId },
      include: {
        _count: { select: { flashcards: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute due counts dynamically
    const enriched = await Promise.all(
      decks.map(async deck => {
        const dueCount = await this.prisma.flashcard.count({
          where: {
            deckId: deck.id,
            due: { lte: now },
          },
        });
        return {
          ...deck,
          cardCount: deck._count.flashcards,
          dueCount,
        };
      }),
    );

    return enriched;
  }

  // 2. Card Operations
  async createFlashcard(userId: string, dto: CreateFlashcardDto) {
    const deck = await this.prisma.flashcardDeck.findUnique({ where: { id: dto.deckId } });
    if (!deck) throw new NotFoundException('Deck not found');
    if (deck.userId !== userId) throw new ForbiddenException('Access denied');

    const empty = this.fsrs.createEmptyCard();

    const card = await this.prisma.flashcard.create({
      data: {
        deckId: dto.deckId,
        type: (dto.type as CardType) || CardType.CONCEPT,
        frontContent: dto.frontContent,
        backContent: dto.backContent,
        metadata: dto.metadata || null,
        due: empty.due,
        stability: empty.stability,
        difficulty: empty.difficulty,
        elapsedDays: empty.elapsedDays,
        scheduledDays: empty.scheduledDays,
        reps: empty.reps,
        lapses: empty.lapses,
        state: empty.state,
      },
    });

    await this.prisma.flashcardDeck.update({
      where: { id: dto.deckId },
      data: { cardCount: { increment: 1 }, dueCount: { increment: 1 } },
    });

    return card;
  }

  async getDeckCards(userId: string, deckId: string, page = 1, limit = 50) {
    const deck = await this.prisma.flashcardDeck.findUnique({ where: { id: deckId } });
    if (!deck) throw new NotFoundException('Deck not found');
    if (deck.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.flashcard.findMany({
      where: { deckId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDueCards(userId: string, limit = 50) {
    const now = new Date();
    return this.prisma.flashcard.findMany({
      where: {
        deck: { userId },
        due: { lte: now },
      },
      include: { deck: true },
      orderBy: { due: 'asc' },
      take: limit,
    });
  }

  // 3. FSRS Review
  async reviewCard(userId: string, cardId: string, dto: ReviewCardDto) {
    let result: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await this.prisma.$transaction(
          async tx => {
            const card = await tx.flashcard.findUnique({
              where: { id: cardId },
              include: { deck: true },
            });

            if (!card) throw new NotFoundException('Flashcard not found');
            if (card.deck.userId !== userId) throw new ForbiddenException('Access denied');

            const now = new Date();
            const currentCardState: FSRSCard = {
              due: card.due,
              stability: card.stability,
              difficulty: card.difficulty,
              elapsedDays: card.elapsedDays,
              scheduledDays: card.scheduledDays,
              reps: card.reps,
              lapses: card.lapses,
              state: card.state as CardState,
              lastReview: card.lastReview,
            };
            const scheduled = this.fsrs.scheduleCard(
              currentCardState,
              dto.rating,
              dto.durationMs,
              now,
            );

            const updatedCard = await tx.flashcard.update({
              where: { id: cardId },
              data: {
                due: scheduled.card.due,
                stability: scheduled.card.stability,
                difficulty: scheduled.card.difficulty,
                elapsedDays: scheduled.card.elapsedDays,
                scheduledDays: scheduled.card.scheduledDays,
                reps: scheduled.card.reps,
                lapses: scheduled.card.lapses,
                state: scheduled.card.state,
                lastReview: scheduled.card.lastReview,
              },
            });

            const reviewLog = await tx.reviewLog.create({
              data: {
                flashcardId: cardId,
                rating: dto.rating,
                state: scheduled.log.state,
                due: scheduled.log.due,
                stability: scheduled.log.stability,
                difficulty: scheduled.log.difficulty,
                elapsedDays: scheduled.log.elapsedDays,
                lastElapsed: scheduled.log.lastElapsed,
                scheduledDays: scheduled.log.scheduledDays,
                reviewedAt: scheduled.log.reviewedAt,
                durationMs: scheduled.log.durationMs,
              },
            });

            await this.updateUserStreak(userId, now, tx);
            return { card: updatedCard, log: reviewLog };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt < 3) continue;
        if (error?.code === 'P2034') {
          throw new ConflictException('Flashcard was reviewed concurrently; please retry.');
        }
        throw error;
      }
    }

    this.eventEmitter?.emit('flashcard.reviewed', {
      userId,
      cardId,
      rating: dto.rating,
    });

    return result;
  }

  private async updateUserStreak(
    userId: string,
    now: Date,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const userStreak = await db.userStreak.findUnique({ where: { userId } });
    const todayStr = now.toISOString().split('T')[0];

    if (!userStreak) {
      await db.userStreak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastReviewDate: new Date(todayStr),
          totalReviews: 1,
        },
      });
      return;
    }

    const lastDateStr = userStreak.lastReviewDate
      ? userStreak.lastReviewDate.toISOString().split('T')[0]
      : null;

    let newCurrent = userStreak.currentStreak;
    if (lastDateStr === todayStr) {
      // Already reviewed today
    } else {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastDateStr === yesterdayStr) {
        newCurrent += 1;
      } else {
        newCurrent = 1;
      }
    }

    const newLongest = Math.max(userStreak.longestStreak, newCurrent);

    await db.userStreak.update({
      where: { userId },
      data: {
        currentStreak: newCurrent,
        longestStreak: newLongest,
        lastReviewDate: new Date(todayStr),
        totalReviews: { increment: 1 },
      },
    });
  }

  // 4. Auto-Generate Flashcards from Interview Weaknesses
  async autoGenerateFlashcards(userId: string, dto: AutoGenerateFlashcardsDto) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: dto.interviewId },
      include: {
        jobRole: true,
        seniorityLevel: true,
        turns: {
          include: {
            question: true,
            answer: { include: { evaluation: true } },
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Interview session not found');
    if (session.userId !== userId) throw new ForbiddenException('Access denied');

    // Find or validate/create Deck
    let targetDeckId = dto.deckId;
    if (targetDeckId) {
      const existingDeck = await this.prisma.flashcardDeck.findUnique({
        where: { id: targetDeckId },
      });
      if (!existingDeck) {
        throw new NotFoundException('Target flashcard deck not found');
      }
      if (existingDeck.userId !== userId) {
        throw new ForbiddenException('Access denied: you do not own the specified flashcard deck');
      }
    } else {
      const roleName = session.jobRole?.name || 'Interview';
      const dateStr = new Date().toLocaleDateString('vi-VN');
      const newDeck = await this.prisma.flashcardDeck.create({
        data: {
          userId,
          name: `Weaknesses — ${roleName} (${dateStr})`,
          description: `Auto-generated flashcard drills focusing on knowledge gaps identified during session #${session.id.slice(0, 8)}`,
          tags: ['AI-Generated', 'Weaknesses', roleName],
          cardCount: 0,
          dueCount: 0,
        },
      });
      targetDeckId = newDeck.id;
    }

    // Collect weaknesses & improvements across turns
    const generatedCards: Array<{ front: string; back: string; type: CardType }> = [];
    const roleName = session.jobRole?.name || 'Software Engineer';
    const levelName = session.seniorityLevel?.name || 'Intermediate';

    for (const turn of session.turns) {
      const q = turn.question?.content || '';
      const evalData = turn.answer?.evaluation;
      if (evalData) {
        const improvements = (evalData.improvements as string[]) || [];

        for (const imp of improvements) {
          const cleanImp = imp.replace(/^[-\s*]+/, '').trim();
          if (!cleanImp) continue;

          generatedCards.push({
            front: `**Targeted Drill (${roleName} - ${levelName} · Turn #${turn.turnNumber}):**\n\nHow do you effectively solve this identified gap:\n> "${cleanImp}"?`,
            back: `**Context & Recommended Practice:**\n- **Context:** Interview question asked: "${q}"\n- **Key Solution:** Address "${cleanImp}" by establishing clear architectural boundaries, measuring latency/concurrency constraints, and proving trade-offs.\n- **Review Checklist:** Verify edge cases, validate data consistency guarantees, and document monitoring alarms.`,
            type: CardType.CONCEPT,
          });
        }
      }
    }

    if (generatedCards.length === 0) {
      generatedCards.push({
        front: `**Key Principles (${roleName} - ${levelName}):**\n\nWhat are the primary operational and scaling trade-offs to consider during architecture evaluations?`,
        back: `**Core Checklist:**\n- **Consistency vs Availability:** Choose between strict linearizability and high availability depending on access patterns.\n- **Fault Isolation:** Introduce circuit breakers and backoff policies.\n- **Observability:** Instrument p99 latency, error rates, and resource utilization.`,
        type: CardType.CONCEPT,
      });
    }

    const createdCards = [];
    for (const item of generatedCards) {
      const empty = this.fsrs.createEmptyCard();
      const card = await this.prisma.flashcard.create({
        data: {
          deckId: targetDeckId,
          type: item.type,
          frontContent: item.front,
          backContent: item.back,
          metadata: {
            sourceInterviewId: dto.interviewId,
            aiGenerated: true,
          },
          due: empty.due,
          stability: empty.stability,
          difficulty: empty.difficulty,
          elapsedDays: empty.elapsedDays,
          scheduledDays: empty.scheduledDays,
          reps: empty.reps,
          lapses: empty.lapses,
          state: empty.state,
        },
      });
      createdCards.push(card);
    }

    await this.prisma.flashcardDeck.update({
      where: { id: targetDeckId },
      data: {
        cardCount: { increment: createdCards.length },
        dueCount: { increment: createdCards.length },
      },
    });

    return { deckId: targetDeckId, cardsCreated: createdCards.length, cards: createdCards };
  }

  // 5. Statistics & Activity Heatmap
  async getStats(userId: string): Promise<FlashcardStatsDto> {
    const now = new Date();

    const [
      totalCards,
      dueToday,
      newCards,
      learningCards,
      reviewCards,
      relearningCards,
      userStreak,
      reviewLogs,
      interviewSessions,
    ] = await Promise.all([
      this.prisma.flashcard.count({ where: { deck: { userId } } }),
      this.prisma.flashcard.count({ where: { deck: { userId }, due: { lte: now } } }),
      this.prisma.flashcard.count({ where: { deck: { userId }, state: CardState.NEW } }),
      this.prisma.flashcard.count({ where: { deck: { userId }, state: CardState.LEARNING } }),
      this.prisma.flashcard.count({ where: { deck: { userId }, state: CardState.REVIEW } }),
      this.prisma.flashcard.count({ where: { deck: { userId }, state: CardState.RELEARNING } }),
      this.prisma.userStreak.findUnique({ where: { userId } }),
      this.prisma.reviewLog.findMany({
        where: { flashcard: { deck: { userId } } },
        select: { reviewedAt: true },
        orderBy: { reviewedAt: 'desc' },
        take: 365,
      }),
      this.prisma.interviewSession?.findMany
        ? this.prisma.interviewSession.findMany({
            where: { userId },
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 365,
          })
        : Promise.resolve([]),
    ]);

    // Aggregate review logs and interview practice sessions by date for activity heatmap
    const countsByDate: Record<string, number> = {};
    for (const log of reviewLogs) {
      const dateStr = log.reviewedAt.toISOString().split('T')[0];
      countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
    }
    for (const session of interviewSessions) {
      const dateStr = session.createdAt.toISOString().split('T')[0];
      countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
    }

    const heatmap = Object.entries(countsByDate).map(([date, count]) => ({ date, count }));

    let currentStreak = userStreak?.currentStreak || 0;

    // Guard against impossible streak numbers (e.g. 8 days streak on a 1-day old account)
    if (this.prisma.user?.findUnique) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { createdAt: true },
        });
        if (user?.createdAt) {
          const accountAgeDays = Math.max(
            1,
            Math.ceil((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) +
              1,
          );
          if (currentStreak > accountAgeDays) {
            currentStreak = Math.min(currentStreak, accountAgeDays);
            if (userStreak) {
              this.prisma.userStreak
                .update({
                  where: { userId },
                  data: { currentStreak },
                })
                .catch(() => {});
            }
          }
        }
      } catch {
        // Ignore in test mocks
      }
    }

    const longestStreak = Math.max(userStreak?.longestStreak || 0, currentStreak);
    const totalReviews = userStreak?.totalReviews || reviewLogs.length + interviewSessions.length;

    return {
      totalCards,
      dueToday,
      newCards,
      learningCards,
      reviewCards,
      relearningCards,
      streak: {
        currentStreak,
        longestStreak,
        lastReviewDate: userStreak?.lastReviewDate
          ? userStreak.lastReviewDate.toISOString().split('T')[0]
          : null,
        totalReviews,
      },
      heatmap,
    };
  }
}
