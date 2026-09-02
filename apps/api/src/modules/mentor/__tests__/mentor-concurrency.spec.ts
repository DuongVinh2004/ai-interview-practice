import { ConflictException } from '@nestjs/common';
import { LiveSessionStatus } from '@ai-interview/contracts';
import { BookingService } from '../services/booking.service';
import { LiveSessionService } from '../services/live-session.service';

describe('mentor concurrency boundaries', () => {
  const approvedPolicy = {
    requireApprovedById: jest.fn().mockResolvedValue(undefined),
    requireApprovedByUser: jest.fn().mockResolvedValue(undefined),
  } as any;

  it('checks collisions and creates the booking in one serializable transaction', async () => {
    const future = new Date(Date.now() + 86_400_000);
    const prisma: any = {
      mentorProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mentor-1',
          userId: 'mentor-user',
          user: { email: 'mentor@test.com', profile: { fullName: 'Mentor' } },
        }),
      },
      liveSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'session-1',
          mentorId: 'mentor-1',
          candidateId: 'candidate-1',
          scheduledAt: future,
          status: LiveSessionStatus.SCHEDULED,
          createdAt: new Date(),
          mentor: { user: { email: 'mentor@test.com', profile: { fullName: 'Mentor' } } },
          candidate: { email: 'candidate@test.com', profile: { fullName: 'Candidate' } },
        }),
      },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };
    const service = new BookingService(prisma, approvedPolicy);

    await service.bookSession('candidate-1', 'mentor-1', future);

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
    expect(prisma.liveSession.create).toHaveBeenCalledTimes(1);
  });

  it('cannot overwrite a terminal state observed after the cancellation read', async () => {
    const prisma: any = {
      liveSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          candidateId: 'candidate-1',
          status: LiveSessionStatus.SCHEDULED,
          mentor: { userId: 'mentor-user' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new BookingService(prisma, approvedPolicy);

    await expect(service.cancelSession('session-1', 'candidate-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.liveSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: [LiveSessionStatus.COMPLETED, LiveSessionStatus.CANCELED] },
        }),
      }),
    );
  });

  it('commits completion and mentor counter in the same transaction', async () => {
    const prisma: any = {
      liveSession: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'session-1',
            mentorId: 'mentor-1',
            mentor: { userId: 'mentor-user' },
          })
          .mockResolvedValueOnce({ id: 'session-1', status: LiveSessionStatus.COMPLETED }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      mentorProfile: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };
    const service = new LiveSessionService(prisma, {} as any, approvedPolicy);

    await service.endSession('session-1', 'mentor-user');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.liveSession.updateMany).toHaveBeenCalled();
    expect(prisma.mentorProfile.update).toHaveBeenCalled();
  });
});
