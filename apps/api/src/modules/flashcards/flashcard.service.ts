import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { FSRSEngine, FSRSCard } from './fsrs/fsrs-engine';
import {
  CreateDeckDto,
  UpdateDeckDto,
  CreateFlashcardDto,
  ReviewCardDto,
  AutoGenerateFlashcardsDto,
} from './dto/flashcard.dto';
import {
  CardType,
  CardState,
  FlashcardStatsDto,
} from '@ai-interview/contracts';

@Injectable()
export class FlashcardService {
  private readonly logger = new Logger(FlashcardService.name);
  private readonly fsrs = new FSRSEngine();

  constructor(private readonly prisma: PrismaService) {}

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
      })
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
    const card = await this.prisma.flashcard.findUnique({
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

    const scheduled = this.fsrs.scheduleCard(currentCardState, dto.rating, dto.durationMs, now);

    // Update Flashcard
    const updatedCard = await this.prisma.flashcard.update({
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

    // Create ReviewLog
    const reviewLog = await this.prisma.reviewLog.create({
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

    // Update UserStreak
    await this.updateUserStreak(userId, now);

    return { card: updatedCard, log: reviewLog };
  }

  private async updateUserStreak(userId: string, now: Date) {
    const userStreak = await this.prisma.userStreak.findUnique({ where: { userId } });
    const todayStr = now.toISOString().split('T')[0];

    if (!userStreak) {
      await this.prisma.userStreak.create({
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

    await this.prisma.userStreak.update({
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

    // Find or create Deck
    let targetDeckId = dto.deckId;
    if (!targetDeckId) {
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

    for (const turn of session.turns) {
      const q = turn.question?.content || '';
      const evalData = turn.answer?.evaluation;
      if (evalData) {
        const improvements = (evalData.improvements as string[]) || [];
        const strengths = (evalData.strengths as string[]) || [];

        for (const imp of improvements) {
          generatedCards.push({
            front: `**Concept Drill (Turn #${turn.turnNumber}):**\n\nHow should you address this architectural trade-off:\n\n> "${imp}"?`,
            back: `**Key Principle & Model Answer:**\n\nRelated Question: "${q}"\n\n**Actionable Takeaway:**\n- Ensure fault isolation and clear resource limits.\n- Discuss failure modes and recovery invariants.\n- Document telemetry metrics and SLA indicators.`,
            type: CardType.CONCEPT,
          });
        }
      }
    }

    if (generatedCards.length === 0) {
      generatedCards.push({
        front: `**Distributed Systems Core:**\n\nWhat is the difference between Optimistic Concurrency Control (OCC) and Pessimistic Locking?`,
        back: `**OCC vs Pessimistic:**\n- OCC checks version/timestamp at commit time without holding locks (best for low contention).\n- Pessimistic locks rows upfront with SELECT FOR UPDATE (best for high contention, prevents transaction rollbacks).`,
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

    const [totalCards, dueToday, newCards, learningCards, reviewCards, relearningCards, userStreak, reviewLogs] =
      await Promise.all([
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
      ]);

    // Aggregate review logs by date for activity heatmap
    const countsByDate: Record<string, number> = {};
    for (const log of reviewLogs) {
      const dateStr = log.reviewedAt.toISOString().split('T')[0];
      countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
    }

    const heatmap = Object.entries(countsByDate).map(([date, count]) => ({ date, count }));

    return {
      totalCards,
      dueToday,
      newCards,
      learningCards,
      reviewCards,
      relearningCards,
      streak: {
        currentStreak: userStreak?.currentStreak || 0,
        longestStreak: userStreak?.longestStreak || 0,
        lastReviewDate: userStreak?.lastReviewDate ? userStreak.lastReviewDate.toISOString().split('T')[0] : null,
        totalReviews: userStreak?.totalReviews || 0,
      },
      heatmap,
    };
  }
}
