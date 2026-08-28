import { Test, TestingModule } from '@nestjs/testing';
import { TutorService } from './tutor.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { AiOrchestratorService } from '../ai-orchestrator/ai-orchestrator.service';
import { TutorRole } from '@ai-interview/contracts';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TutorService (F006)', () => {
  let tutorService: TutorService;

  const mockPrisma = {
    interviewSession: {
      findUnique: jest.fn(),
    },
    tutorSession: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tutorMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    questionRetry: {
      upsert: jest.fn(),
    },
  };

  const mockAiOrchestrator = {
    streamSocraticChat: jest.fn().mockImplementation(async (sessionId, ctx, prompt, onToken) => {
      onToken?.('Socratic guidance token ');
      return {
        data: {
          fullText: 'Socratic guidance token',
          references: [{ title: 'MDN', url: 'https://developer.mozilla.org' }],
        },
      };
    }),
    evaluateAnswer: jest.fn().mockResolvedValue({
      score: 8.5,
      conciseFeedback: 'Good understanding of distributed locks.',
      strengths: ['Mentioned Redlock and UUID token ownership.'],
      improvements: ['Consider clock drift edge case.'],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TutorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiOrchestratorService, useValue: mockAiOrchestrator },
      ],
    }).compile();

    tutorService = module.get<TutorService>(TutorService);
    jest.clearAllMocks();
  });

  describe('createOrGetSession', () => {
    it('creates a new tutor session with initial Socratic greeting when none exists', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
        id: 'int-123',
        userId: 'user-1',
        turns: [
          {
            turnNumber: 1,
            question: { content: 'Explain Node.js event loop' },
            answer: { evaluation: { score: 6.0, improvements: ['Explain microtask queue order'] } },
          },
        ],
      });

      mockPrisma.tutorSession.findUnique.mockResolvedValueOnce(null);
      mockPrisma.tutorSession.create.mockResolvedValueOnce({
        id: 'tutor-sess-1',
        userId: 'user-1',
        interviewId: 'int-123',
        turnNumber: 1,
        turnCount: 0,
      });
      mockPrisma.tutorMessage.create.mockResolvedValueOnce({
        id: 'msg-1',
        sessionId: 'tutor-sess-1',
        role: TutorRole.AI_TUTOR,
        content: 'Hi! I am your AI Socratic Tutor...',
      });
      mockPrisma.tutorSession.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'tutor-sess-1',
        messages: [{ id: 'msg-1', role: TutorRole.AI_TUTOR, content: 'Hi!' }],
      });

      const result = await tutorService.createOrGetSession('user-1', {
        interviewId: 'int-123',
        turnNumber: 1,
      });

      expect(result.id).toBe('tutor-sess-1');
      expect(mockPrisma.tutorMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'tutor-sess-1',
            role: TutorRole.AI_TUTOR,
          }),
        }),
      );
    });
  });

  describe('sendChatMessageStream', () => {
    it('streams response chunks via SSE and saves messages', async () => {
      mockPrisma.tutorSession.findUnique.mockResolvedValueOnce({
        id: 'tutor-sess-1',
        userId: 'user-1',
        turnCount: 2,
        messages: [],
      });

      const writtenChunks: string[] = [];
      const mockRes: any = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn().mockImplementation((chunk: string) => writtenChunks.push(chunk)),
        end: jest.fn(),
      };

      await tutorService.sendChatMessageStream(
        'user-1',
        'tutor-sess-1',
        { message: 'How do I handle cache stampede?' },
        mockRes,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.write).toHaveBeenCalled();
      expect(mockRes.end).toHaveBeenCalled();

      expect(mockPrisma.tutorMessage.create).toHaveBeenCalledTimes(2); // USER msg + AI msg
      expect(mockPrisma.tutorSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tutor-sess-1' },
          data: { turnCount: { increment: 1 } },
        }),
      );
    });

    it('rejects chat when turnCount reaches 20 messages', async () => {
      mockPrisma.tutorSession.findUnique.mockResolvedValueOnce({
        id: 'tutor-sess-1',
        userId: 'user-1',
        turnCount: 20,
        messages: [],
      });

      const mockRes: any = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };

      await expect(
        tutorService.sendChatMessageStream(
          'user-1',
          'tutor-sess-1',
          { message: 'One more question' },
          mockRes,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitRetry', () => {
    it('evaluates retry answer, computes score improvement, and records QuestionRetry', async () => {
      mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
        id: 'int-123',
        userId: 'user-1',
        turns: [
          {
            turnNumber: 1,
            question: { content: 'Explain distributed locking' },
            answer: {
              content: 'Just use Redis SETNX.',
              evaluation: { score: 5.0 },
            },
          },
        ],
      });

      mockPrisma.questionRetry.upsert.mockResolvedValueOnce({
        id: 'retry-uuid-1',
        userId: 'user-1',
        interviewId: 'int-123',
        turnNumber: 1,
        originalAnswer: 'Just use Redis SETNX.',
        retryAnswer:
          'Use Redlock algorithm with TTL and random UUID token to prevent releasing other locks.',
        originalScore: 5.0,
        retryScore: 8.5,
        improvement: 3.5,
        createdAt: new Date(),
      });

      const result = await tutorService.submitRetry('user-1', {
        interviewId: 'int-123',
        turnNumber: 1,
        retryAnswer:
          'Use Redlock algorithm with TTL and random UUID token to prevent releasing other locks.',
      });

      expect(result.retryId).toBe('retry-uuid-1');
      expect(result.originalScore).toBe(5.0);
      expect(result.retryScore).toBeGreaterThan(5.0);
      expect(result.improvement).toBeGreaterThan(0);
      expect(result.feedback.keyStrengths.length).toBeGreaterThan(0);
    });
  });
});
