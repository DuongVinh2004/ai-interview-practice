import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardService } from '../flashcard.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

describe('Flashcard Deck Injection & Ownership (P1-010)', () => {
  let flashcardService: FlashcardService;

  const mockPrisma = {
    interviewSession: {
      findUnique: jest.fn(),
    },
    flashcardDeck: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    flashcard: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FlashcardService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    flashcardService = module.get<FlashcardService>(FlashcardService);
    jest.clearAllMocks();
  });

  const callerUserId = 'user-caller-123';
  const victimUserId = 'user-victim-456';
  const victimDeckId = 'deck-victim-789';
  const interviewId = 'interview-123';

  it('rejects card generation into a deck owned by another user', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue({
      id: interviewId,
      userId: callerUserId,
      turns: [],
    });

    mockPrisma.flashcardDeck.findUnique.mockResolvedValue({
      id: victimDeckId,
      userId: victimUserId, // Different owner!
    });

    await expect(
      flashcardService.autoGenerateFlashcards(callerUserId, {
        interviewId,
        deckId: victimDeckId,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(mockPrisma.flashcard.create).not.toHaveBeenCalled();
  });
});
