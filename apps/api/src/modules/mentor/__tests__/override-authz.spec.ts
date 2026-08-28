import { Test, TestingModule } from '@nestjs/testing';
import { LiveSessionService } from '../services/live-session.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { LiveSessionStatus, MentorAuthorityState } from '@ai-interview/contracts';
import { MentorAuthorityPolicy } from '../policies/mentor-authority.policy';

describe('Mentor Score Override Authorization (SEC-006)', () => {
  let liveSessionService: LiveSessionService;

  const mockPrisma: any = {
    evaluation: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    mentorProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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
    evaluationRun: {
      findFirst: jest.fn(),
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
        MentorAuthorityPolicy,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'MEDIA_PROVIDER', useValue: mockMediaProvider },
      ],
    }).compile();

    liveSessionService = module.get<LiveSessionService>(LiveSessionService);
    jest.clearAllMocks();
    mockPrisma.mentorProfile.findFirst.mockResolvedValue({
      id: 'mentor-profile-1',
      userId: assignedMentorUserId,
      authorityState: MentorAuthorityState.APPROVED,
      isActive: true,
    });
    mockPrisma.evaluationRun.findFirst.mockResolvedValue(null);
    mockPrisma.evaluationRun.create.mockResolvedValue({ id: 'run-1', runNumber: 1 });
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
            createdAt: new Date(),
          },
        },
      },
    });

    mockPrisma.mentorProfile.findFirst.mockResolvedValue({
      id: 'mentor-profile-2',
      userId: unassignedMentorUserId,
      authorityState: MentorAuthorityState.APPROVED,
      isActive: true,
    });

    mockPrisma.liveSession.findFirst.mockResolvedValue(null);

    await expect(
      liveSessionService.overrideScore(
        evaluationId,
        unassignedMentorUserId,
        9.0,
        'Override reason is valid',
      ),
    ).rejects.toThrow(
      new ForbiddenException(
        'An exact active mentor, candidate, and interview engagement is required',
      ),
    );

    expect(mockPrisma.evaluation.update).not.toHaveBeenCalled();
  });

  it('allows assigned mentor in active session to override score with transaction and audit log', async () => {
    mockPrisma.evaluation.findUnique.mockResolvedValue({
      id: evaluationId,
      score: 6.0,
      conciseFeedback: 'Needs improvement',
      answer: {
        turn: {
          sessionId,
          session: {
            userId: candidateUserId,
            createdAt: new Date(),
          },
        },
      },
    });

    // Active in-progress live session
    mockPrisma.liveSession.findFirst.mockResolvedValue({
      id: 'live-session-1',
      mentorId: 'mentor-profile-1',
      candidateId: candidateUserId,
      interviewId: sessionId,
      status: LiveSessionStatus.IN_PROGRESS,
      scheduledAt: new Date(),
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
    expect(mockPrisma.evaluation.update).toHaveBeenCalledWith({
      where: { id: evaluationId },
      data: expect.objectContaining({
        score: 9.0,
        needsReview: false,
        authorityState: 'AUTHORITATIVE',
      }),
    });
    expect(mockPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: sessionId },
      data: { overallScore: 9.0 },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'EVALUATION_OVERRIDDEN',
        userId: assignedMentorUserId,
      }),
    });
  });

  it('allows override within bounded 48-hour window after COMPLETED session', async () => {
    const sessionEndTime = new Date(Date.now() - 2 * 3600 * 1000); // 2 hours ago

    mockPrisma.evaluation.findUnique.mockResolvedValue({
      id: evaluationId,
      score: 5.0,
      conciseFeedback: 'Initial feedback',
      answer: {
        turn: {
          sessionId,
          session: {
            userId: candidateUserId,
            createdAt: new Date(Date.now() - 3 * 3600 * 1000), // 3 hours ago
          },
        },
      },
    });

    mockPrisma.liveSession.findFirst.mockResolvedValue({
      id: 'live-session-1',
      mentorId: 'mentor-profile-1',
      candidateId: candidateUserId,
      interviewId: sessionId,
      status: LiveSessionStatus.COMPLETED,
      endedAt: sessionEndTime,
    });

    mockPrisma.evaluation.update.mockResolvedValue({ id: evaluationId, score: 8.0 });
    mockPrisma.evaluation.findMany.mockResolvedValue([{ id: evaluationId, score: 8.0 }]);
    mockPrisma.interviewSession.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await liveSessionService.overrideScore(
      evaluationId,
      assignedMentorUserId,
      8.0,
      'Clarified system design during debrief',
    );

    expect(result.newScore).toBe(8.0);
  });

  it('rejects override when 48-hour window after COMPLETED session has expired', async () => {
    const sessionEndTime = new Date(Date.now() - 50 * 3600 * 1000); // 50 hours ago (> 48h)

    mockPrisma.evaluation.findUnique.mockResolvedValue({
      id: evaluationId,
      score: 5.0,
      conciseFeedback: 'Initial feedback',
      answer: {
        turn: {
          sessionId,
          session: {
            userId: candidateUserId,
            createdAt: new Date(Date.now() - 52 * 3600 * 1000),
          },
        },
      },
    });

    mockPrisma.liveSession.findFirst.mockResolvedValue({
      id: 'live-session-1',
      mentorId: 'mentor-profile-1',
      candidateId: candidateUserId,
      interviewId: sessionId,
      status: LiveSessionStatus.COMPLETED,
      endedAt: sessionEndTime,
    });

    await expect(
      liveSessionService.overrideScore(
        evaluationId,
        assignedMentorUserId,
        8.0,
        'Late override attempt',
      ),
    ).rejects.toThrow(
      new ForbiddenException(
        'Mentor score override window has expired for this live session (48-hour limit)',
      ),
    );
  });

  it('rejects the same mentor and candidate when the live session is not bound to the exact interview', async () => {
    mockPrisma.evaluation.findUnique.mockResolvedValue({
      id: evaluationId,
      score: 5.0,
      conciseFeedback: 'Initial feedback',
      answer: {
        turn: {
          sessionId,
          session: {
            userId: candidateUserId,
            createdAt: new Date(),
          },
        },
      },
    });

    mockPrisma.liveSession.findFirst.mockResolvedValue(null);

    await expect(
      liveSessionService.overrideScore(
        evaluationId,
        assignedMentorUserId,
        8.0,
        'Attempting to alter future interview',
      ),
    ).rejects.toThrow('An exact active mentor, candidate, and interview engagement is required');
    expect(mockPrisma.liveSession.findFirst).toHaveBeenCalledWith({
      where: {
        mentorId: 'mentor-profile-1',
        candidateId: candidateUserId,
        interviewId: sessionId,
        status: { in: [LiveSessionStatus.IN_PROGRESS, LiveSessionStatus.COMPLETED] },
      },
    });
  });

  it('rejects a scheduled engagement that has not started', async () => {
    mockPrisma.evaluation.findUnique.mockResolvedValue({
      id: evaluationId,
      score: 5.0,
      conciseFeedback: 'Initial feedback',
      answer: { turn: { sessionId, session: { userId: candidateUserId } } },
    });
    mockPrisma.liveSession.findFirst.mockResolvedValue(null);

    await expect(
      liveSessionService.overrideScore(
        evaluationId,
        assignedMentorUserId,
        8.0,
        'Session has not started',
      ),
    ).rejects.toThrow('An exact active mentor, candidate, and interview engagement is required');
    expect(mockPrisma.liveSession.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        interviewId: sessionId,
        status: { in: [LiveSessionStatus.IN_PROGRESS, LiveSessionStatus.COMPLETED] },
      }),
    });
  });

  it('rejects a suspended mentor even when an exact active engagement exists', async () => {
    mockPrisma.evaluation.findUnique.mockResolvedValue({
      id: evaluationId,
      score: 5.0,
      conciseFeedback: 'Initial feedback',
      answer: { turn: { sessionId, session: { userId: candidateUserId } } },
    });
    mockPrisma.mentorProfile.findFirst.mockResolvedValue(null);

    await expect(
      liveSessionService.overrideScore(
        evaluationId,
        assignedMentorUserId,
        8.0,
        'Suspended mentor attempt',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.liveSession.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.evaluation.update).not.toHaveBeenCalled();
  });

  it('rejects invalid score range (<0 or >10)', async () => {
    await expect(
      liveSessionService.overrideScore(
        evaluationId,
        assignedMentorUserId,
        11.5,
        'Valid justification text',
      ),
    ).rejects.toThrow(new BadRequestException('Score must be a number between 0.0 and 10.0'));

    await expect(
      liveSessionService.overrideScore(
        evaluationId,
        assignedMentorUserId,
        -1.0,
        'Valid justification text',
      ),
    ).rejects.toThrow(new BadRequestException('Score must be a number between 0.0 and 10.0'));
  });

  it('rejects invalid or insufficient justification (<5 chars)', async () => {
    await expect(
      liveSessionService.overrideScore(evaluationId, assignedMentorUserId, 8.0, 'ok'),
    ).rejects.toThrow(
      new BadRequestException(
        'A valid justification of at least 5 characters is required for score override',
      ),
    );
  });

  it('rejects override when evaluation is not found', async () => {
    mockPrisma.evaluation.findUnique.mockResolvedValue(null);

    await expect(
      liveSessionService.overrideScore(
        'non-existent-eval',
        assignedMentorUserId,
        8.0,
        'Valid justification text',
      ),
    ).rejects.toThrow(new NotFoundException('Evaluation record not found'));
  });
});
