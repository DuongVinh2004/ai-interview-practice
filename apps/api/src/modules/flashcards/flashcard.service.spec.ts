import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardService } from './flashcard.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { CardState, FSRSRating, CardType } from '@ai-interview/contracts';

describe('FlashcardService (F005)', () => {
  let service: FlashcardService;

  const mockPrisma: any = {
    flashcardDeck: {
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: 'deck-1', ...data })),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: 'deck-1' }),
    },
    flashcard: {
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: 'card-1', ...data })),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: 'card-1', ...data })),
      count: jest.fn().mockResolvedValue(10),
    },
    reviewLog: {
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: 'log-1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    userStreak: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ currentStreak: 1 }),
      update: jest.fn().mockResolvedValue({ currentStreak: 2 }),
    },
    interviewSession: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FlashcardService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<FlashcardService>(FlashcardService);
    jest.clearAllMocks();
  });

  describe('Deck Operations', () => {
    it('creates a new deck and returns user decks with due counts', async () => {
      const deck = await service.createDeck('user-1', {
        name: 'Distributed Systems',
        description: 'Key architectural invariants and patterns',
        tags: ['Architecture', 'Backend'],
      });

      expect(deck.id).toBe('deck-1');
      expect(deck.name).toBe('Distributed Systems');
      expect(mockPrisma.flashcardDeck.create).toHaveBeenCalled();
    });
  });

  describe('Card Creation & FSRS Review', () => {
    it('creates a flashcard with initial FSRS state', async () => {
      mockPrisma.flashcardDeck.findUnique.mockResolvedValueOnce({
        id: 'deck-1',
        userId: 'user-1',
      });

      const card = await service.createFlashcard('user-1', {
        deckId: 'deck-1',
        type: CardType.CONCEPT,
        frontContent: 'What is CAP theorem?',
        backContent: 'Consistency, Availability, Partition Tolerance (choose 2 of 3).',
      });

      expect(card.id).toBe('card-1');
      expect(card.state).toBe(CardState.NEW);
      expect(card.reps).toBe(0);
      expect(mockPrisma.flashcard.create).toHaveBeenCalled();
    });

    it('reviews a flashcard, advances FSRS state, creates review log and updates streak', async () => {
      mockPrisma.flashcard.findUnique.mockResolvedValueOnce({
        id: 'card-1',
        deckId: 'deck-1',
        state: CardState.NEW,
        due: new Date(),
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        lastReview: null,
        deck: { userId: 'user-1' },
      });

      mockPrisma.userStreak.findUnique.mockResolvedValueOnce(null);

      const result = await service.reviewCard('user-1', 'card-1', {
        rating: FSRSRating.GOOD,
        durationMs: 3500,
      });

      expect(result.card.state).toBe(CardState.REVIEW);
      expect(result.card.reps).toBe(1);
      expect(result.card.stability).toBe(2.4);
      expect(mockPrisma.reviewLog.create).toHaveBeenCalled();
      expect(mockPrisma.userStreak.create).toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    });
  });

  describe('Auto-Generate from Interview Weaknesses', () => {
    it('generates flashcards from interview session weaknesses', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
        id: 'session-uuid-1',
        userId: 'user-1',
        jobRole: { name: 'Backend Engineer' },
        turns: [
          {
            turnNumber: 1,
            question: { content: 'Explain Redis cluster replication' },
            answer: {
              evaluation: {
                improvements: ['Clarify split-brain handling during sentinel failover'],
                strengths: ['Good basic Redis command knowledge'],
              },
            },
          },
        ],
      });

      mockPrisma.flashcardDeck.findUnique.mockResolvedValueOnce({
        id: 'deck-1',
        userId: 'user-1',
      });

      const result = await service.autoGenerateFlashcards('user-1', {
        interviewId: 'session-uuid-1',
        deckId: 'deck-1',
      });

      expect(result.cardsCreated).toBeGreaterThan(0);
      expect(mockPrisma.flashcard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            frontContent: expect.stringContaining('split-brain handling'),
          }),
        }),
      );
    });
  });

  describe('Statistics & Activity Heatmap', () => {
    it('aggregates stats, due counts, and review logs into heatmap', async () => {
      mockPrisma.userStreak.findUnique.mockResolvedValueOnce({
        currentStreak: 5,
        longestStreak: 12,
        lastReviewDate: new Date('2026-08-24'),
        totalReviews: 45,
      });

      mockPrisma.reviewLog.findMany.mockResolvedValueOnce([
        { reviewedAt: new Date('2026-08-24T10:00:00Z') },
        { reviewedAt: new Date('2026-08-24T11:00:00Z') },
        { reviewedAt: new Date('2026-08-23T09:00:00Z') },
      ]);

      const stats = await service.getStats('user-1');

      expect(stats.totalCards).toBe(10);
      expect(stats.streak.currentStreak).toBe(5);
      expect(stats.streak.longestStreak).toBe(12);
      expect(stats.heatmap.length).toBe(2); // 2 distinct dates
    });
  });
});
