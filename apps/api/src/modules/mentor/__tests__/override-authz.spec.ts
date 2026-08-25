import { Test, TestingModule } from '@nestjs/testing';
import { LiveSessionService } from '../services/live-session.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Mentor Score Override Authorization (P1-004)', () => {
  let liveSessionService: LiveSessionService;

  const mockPrisma: any = {
    evaluation: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    mentorProfile: {
      findUnique: jest.fn(),
    },
    liveSession: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    interviewSession: {
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(cb => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
  };

  const mockMediaProvider = {
    createRoom: jest.fn(),
    generateToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveSessionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'MEDIA_PROVIDER', useValue: mockMediaProvider },
      ],
    }).compile();

    liveSessionService = module.get<LiveSessionService>(LiveSessionService);
    jest.clearAllMocks();
  });

  const assignedMentorUserId = 'mentor-assigned-1';
  const unassignedMentorUserId = 'mentor-unassigned-2';
  const candidateUserId = 'candidate-1';
  const evaluationId = 'eval-123';
  const sessionId = 'session-123';

  it('rejects score override if mentor is not assigned to the candidate session', async () => {
    mockPrisma.evaluation.findUnique.mockResolvedValue({
      id: evaluationId,
      score: 6.0,
      conciseFeedback: 'Needs improvement',
      answer: {
        turn: {
          sessionId,
          session: {
            userId: candidateUserId,
          },
        },
      },
    });

    mockPrisma.mentorProfile.findUnique.mockResolvedValue({
      id: 'mentor-profile-2',
      userId: unassignedMentorUserId,
    });

    // No live session assignment exists between unassigned mentor and candidate
    mockPrisma.liveSession.findFirst.mockResolvedValue(null);

    await expect(
      liveSessionService.overrideScore(
        evaluationId,
        unassignedMentorUserId,
        9.0,
        'Override reason',
      ),
    ).rejects.toThrow(
      new ForbiddenException("You are not the designated mentor for this candidate's session"),
    );

    expect(mockPrisma.evaluation.update).not.toHaveBeenCalled();
  });

  it('allows assigned mentor to override score with transaction and audit log', async () => {
    mockPrisma.evaluation.findUnique.mockResolvedValue({
      id: evaluationId,
      score: 6.0,
      conciseFeedback: 'Needs improvement',
      answer: {
        turn: {
          sessionId,
          session: {
            userId: candidateUserId,
          },
        },
      },
    });

    mockPrisma.mentorProfile.findUnique.mockResolvedValue({
      id: 'mentor-profile-1',
      userId: assignedMentorUserId,
    });

    // Valid assignment exists
    mockPrisma.liveSession.findFirst.mockResolvedValue({
      id: 'live-session-1',
      mentorId: 'mentor-profile-1',
      candidateId: candidateUserId,
    });

    mockPrisma.evaluation.update.mockResolvedValue({
      id: evaluationId,
      score: 9.0,
      conciseFeedback: 'Updated feedback',
    });

    mockPrisma.evaluation.findMany.mockResolvedValue([{ id: evaluationId, score: 9.0 }]);

    mockPrisma.interviewSession.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await liveSessionService.overrideScore(
      evaluationId,
      assignedMentorUserId,
      9.0,
      'Excellent performance in live discussion',
    );

    expect(result.newScore).toBe(9.0);
    expect(result.overriddenByMentorId).toBe('mentor-profile-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'EVALUATION_OVERRIDDEN',
        userId: assignedMentorUserId,
      }),
    });
  });
});
