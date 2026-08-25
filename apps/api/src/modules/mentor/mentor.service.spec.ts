import { Test, TestingModule } from '@nestjs/testing';
import { MentorService } from './services/mentor.service';
import { BookingService } from './services/booking.service';
import { LiveSessionService } from './services/live-session.service';
import { CopilotHintService } from './services/copilot-hint.service';
import { MockMediaProvider } from './providers/mock-media.provider';
import { PrismaService } from '../platform/prisma/prisma.service';
import { LiveSessionStatus, CompetencyArea } from '@ai-interview/contracts';
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('Track F012: Mentor Co-Pilot Module', () => {
  let mentorService: MentorService;
  let bookingService: BookingService;
  let liveSessionService: LiveSessionService;
  let copilotHintService: CopilotHintService;
  let prisma: PrismaService;

  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
    },
    mentorProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    mentorAvailability: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    liveSession: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    evaluation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    interviewSession: {
      update: jest.fn(),
    },
    interviewTurn: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(cb => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorService,
        BookingService,
        LiveSessionService,
        CopilotHintService,
        {
          provide: 'MEDIA_PROVIDER',
          useClass: MockMediaProvider,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    mentorService = module.get<MentorService>(MentorService);
    bookingService = module.get<BookingService>(BookingService);
    liveSessionService = module.get<LiveSessionService>(LiveSessionService);
    copilotHintService = module.get<CopilotHintService>(CopilotHintService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('1. Mentor Profile & Directory', () => {
    it('creates or retrieves mentor profile with availability slots', async () => {
      const userId = 'user-mentor-1';
      mockPrisma.mentorProfile.findUnique.mockResolvedValue({
        id: 'mentor-1',
        userId,
        expertiseAreas: ['System Design', 'Distributed Systems'],
        rating: 4.9,
        totalSessions: 24,
        bio: 'Staff Engineer at Big Tech',
        isActive: true,
        availabilities: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true }],
        user: { email: 'mentor@test.com', profile: { fullName: 'Sarah Connor' } },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const profile = await mentorService.getOrCreateMentorProfile(userId);
      expect(profile.id).toBe('mentor-1');
      expect(profile.fullName).toBe('Sarah Connor');
      expect(profile.rating).toBe(4.9);
      expect(profile.availabilities?.length).toBe(1);
    });
  });

  describe('2. Collision-Safe Slot Booking', () => {
    it('books a valid future session when no time collisions exist', async () => {
      const candidateId = 'candidate-1';
      const mentorId = 'mentor-1';
      const futureDate = new Date(Date.now() + 86400000 * 2); // 2 days later

      mockPrisma.mentorProfile.findUnique.mockResolvedValue({
        id: mentorId,
        userId: 'mentor-user-1',
        isActive: true,
        user: { email: 'mentor@test.com', profile: { fullName: 'Sarah Connor' } },
      });

      // No collisions
      mockPrisma.liveSession.findFirst.mockResolvedValue(null);

      mockPrisma.liveSession.create.mockResolvedValue({
        id: 'session-live-1',
        mentorId,
        candidateId,
        scheduledAt: futureDate,
        status: LiveSessionStatus.SCHEDULED,
        createdAt: new Date(),
        mentor: { user: { email: 'mentor@test.com', profile: { fullName: 'Sarah Connor' } } },
        candidate: { profile: { fullName: 'Alex Rivera' } },
      });

      const booked = await bookingService.bookSession(candidateId, mentorId, futureDate);
      expect(booked.id).toBe('session-live-1');
      expect(booked.status).toBe(LiveSessionStatus.SCHEDULED);
      expect(booked.mentorName).toBe('Sarah Connor');
    });

    it('rejects booking when mentor has an overlapping session in the 45-minute window', async () => {
      const candidateId = 'candidate-1';
      const mentorId = 'mentor-1';
      const futureDate = new Date(Date.now() + 86400000 * 2);

      mockPrisma.mentorProfile.findUnique.mockResolvedValue({
        id: mentorId,
        userId: 'mentor-user-1',
        isActive: true,
        user: { email: 'mentor@test.com', profile: { fullName: 'Sarah Connor' } },
      });

      // Collision exists
      mockPrisma.liveSession.findFirst.mockResolvedValueOnce({
        id: 'existing-session',
        scheduledAt: futureDate,
      });

      await expect(bookingService.bookSession(candidateId, mentorId, futureDate)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects booking when candidate attempts to book themselves', async () => {
      const candidateId = 'user-mentor-1';
      const mentorId = 'mentor-1';
      const futureDate = new Date(Date.now() + 86400000);

      mockPrisma.mentorProfile.findUnique.mockResolvedValue({
        id: mentorId,
        userId: candidateId, // Self!
        isActive: true,
        user: { email: 'self@test.com' },
      });

      await expect(bookingService.bookSession(candidateId, mentorId, futureDate)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('3. Live Room Lifecycle & Tokens', () => {
    it('generates role-specific ephemeral room tokens for mentor and candidate', async () => {
      const sessionId = 'session-123';
      const mentorUserId = 'mentor-user-1';
      const candidateUserId = 'candidate-user-1';

      mockPrisma.liveSession.findUnique.mockResolvedValue({
        id: sessionId,
        mentorId: 'm-1',
        candidateId: candidateUserId,
        scheduledAt: new Date(),
        status: LiveSessionStatus.SCHEDULED,
        mentor: {
          userId: mentorUserId,
          user: { email: 'mentor@test.com', profile: { fullName: 'Sarah Connor' } },
        },
        candidate: { profile: { fullName: 'Alex Rivera' } },
      });
      mockPrisma.liveSession.update.mockResolvedValue({});

      // Join as Mentor
      const mentorJoin = await liveSessionService.joinSession(sessionId, mentorUserId);
      expect(mentorJoin.role).toBe('MENTOR');
      expect(mentorJoin.participantName).toBe('Sarah Connor');
      expect(mentorJoin.roomToken).toBeDefined();

      // Join as Candidate
      const candidateJoin = await liveSessionService.joinSession(sessionId, candidateUserId);
      expect(candidateJoin.role).toBe('CANDIDATE');
      expect(candidateJoin.participantName).toBe('Alex Rivera');
    });

    it('denies room access to unauthorized 3rd party users', async () => {
      const sessionId = 'session-123';
      mockPrisma.liveSession.findUnique.mockResolvedValue({
        id: sessionId,
        mentorId: 'm-1',
        candidateId: 'candidate-user-1',
        mentor: { userId: 'mentor-user-1', user: { email: 'mentor@test.com' } },
        candidate: { profile: {} },
      });

      await expect(liveSessionService.joinSession(sessionId, 'intruder-user-99')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('4. Score Override & Audit Trail', () => {
    it('updates evaluation score with audit justification and recalculates session average', async () => {
      const evalId = 'eval-123';
      const mentorUserId = 'mentor-user-1';

      mockPrisma.evaluation.findUnique.mockResolvedValue({
        id: evalId,
        score: 6.5,
        conciseFeedback: 'AI Evaluation feedback text.',
        answer: {
          turn: {
            sessionId: 'session-parent-1',
            session: {
              userId: 'candidate-1',
            },
          },
        },
      });

      mockPrisma.mentorProfile.findUnique.mockResolvedValue({
        id: 'mentor-1',
        userId: mentorUserId,
      });

      mockPrisma.liveSession.findFirst.mockResolvedValue({
        id: 'live-1',
        mentorId: 'mentor-1',
        candidateId: 'candidate-1',
      });

      mockPrisma.evaluation.update.mockResolvedValue({
        id: evalId,
        score: 8.5,
        conciseFeedback:
          'AI Evaluation feedback text.\n\n[Mentor Score Override ... Reason: Candidate explained caching strategy during follow-up.]',
      });

      mockPrisma.evaluation.findMany.mockResolvedValue([{ score: 8.5 }, { score: 7.5 }]);
      mockPrisma.interviewSession.update.mockResolvedValue({});

      const override = await liveSessionService.overrideScore(
        evalId,
        mentorUserId,
        8.5,
        'Candidate explained caching strategy during follow-up.',
      );

      expect(override.originalScore).toBe(6.5);
      expect(override.newScore).toBe(8.5);
      expect(override.justification).toBe('Candidate explained caching strategy during follow-up.');
      expect(mockPrisma.interviewSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-parent-1' },
          data: { overallScore: 8.0 }, // (8.5 + 7.5) / 2
        }),
      );
    });
  });

  describe('5. Real-Time Probing Co-Pilot Hints', () => {
    it('returns contextual probing questions for deep-dive technical interview', async () => {
      mockPrisma.interviewTurn.findMany.mockResolvedValue([
        {
          question: { keyFocus: 'Distributed Cache Invalidation' },
          answer: {},
        },
      ]);

      const result = await copilotHintService.getProbingHints(
        'session-1',
        'Distributed Cache Invalidation',
      );
      expect(result.hints.length).toBeGreaterThan(0);
      expect(result.hints[0].questionText).toContain('traffic surge');
      expect(result.hints[0].expectedKeySignals.length).toBeGreaterThan(0);
    });
  });
});
