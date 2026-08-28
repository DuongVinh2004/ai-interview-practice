import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MentorAuthorityState } from '@ai-interview/contracts';
import { MentorAuthorityPolicy } from '../policies/mentor-authority.policy';
import { MentorService } from '../services/mentor.service';

describe('Mentor authority lifecycle', () => {
  const prisma: any = {
    mentorProfile: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn((callback: (tx: any) => unknown) => callback(prisma)),
  };

  let policy: MentorAuthorityPolicy;
  let service: MentorService;

  beforeEach(() => {
    jest.clearAllMocks();
    policy = new MentorAuthorityPolicy(prisma);
    service = new MentorService(prisma);
  });

  it.each([
    MentorAuthorityState.PENDING,
    MentorAuthorityState.SUSPENDED,
    MentorAuthorityState.REVOKED,
  ])('rejects %s profiles as mentor authority', async state => {
    prisma.mentorProfile.findFirst.mockResolvedValue(null);

    await expect(policy.requireApprovedByUser('mentor-user')).rejects.toThrow(ForbiddenException);
    expect(prisma.mentorProfile.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'mentor-user',
        authorityState: MentorAuthorityState.APPROVED,
        isActive: true,
      },
    });
  });

  it('accepts only an active approved profile', async () => {
    const approved = {
      id: 'mentor-1',
      userId: 'mentor-user',
      authorityState: MentorAuthorityState.APPROVED,
      isActive: true,
    };
    prisma.mentorProfile.findFirst.mockResolvedValue(approved);

    await expect(policy.requireApprovedByUser('mentor-user')).resolves.toBe(approved);
  });

  it('approves a pending profile with a compare-and-set transition and audit record', async () => {
    prisma.mentorProfile.findUnique
      .mockResolvedValueOnce({
        id: 'mentor-1',
        authorityState: MentorAuthorityState.PENDING,
      })
      .mockResolvedValueOnce({
        id: 'mentor-1',
        authorityState: MentorAuthorityState.APPROVED,
      });
    prisma.mentorProfile.updateMany.mockResolvedValue({ count: 1 });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await service.transitionAuthority(
      'mentor-1',
      'admin-1',
      MentorAuthorityState.APPROVED,
      'Identity and expertise verified',
    );

    expect(prisma.mentorProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mentor-1', authorityState: MentorAuthorityState.PENDING },
        data: expect.objectContaining({
          authorityState: MentorAuthorityState.APPROVED,
          isActive: true,
          approvedByUserId: 'admin-1',
          authorityChangedByUserId: 'admin-1',
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'MENTOR_AUTHORITY_CHANGED',
        details: expect.objectContaining({
          previousState: MentorAuthorityState.PENDING,
          newState: MentorAuthorityState.APPROVED,
        }),
      }),
    });
  });

  it('rejects invalid state transitions before writing or auditing', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue({
      id: 'mentor-1',
      authorityState: MentorAuthorityState.REVOKED,
    });

    await expect(
      service.transitionAuthority(
        'mentor-1',
        'admin-1',
        MentorAuthorityState.APPROVED,
        'Attempted reactivation',
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.mentorProfile.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('fails a concurrent transition without creating a misleading audit record', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue({
      id: 'mentor-1',
      authorityState: MentorAuthorityState.PENDING,
    });
    prisma.mentorProfile.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.transitionAuthority(
        'mentor-1',
        'admin-1',
        MentorAuthorityState.APPROVED,
        'Identity and expertise verified',
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('uses an explicit safe projection for administrative authority responses', async () => {
    prisma.mentorProfile.findMany.mockResolvedValue([]);

    await service.listAuthorityRequests();

    expect(prisma.mentorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: { id: true, fullName: true, targetRole: true, targetLevel: true },
              },
            },
          },
        }),
      }),
    );
    const options = prisma.mentorProfile.findMany.mock.calls[0][0];
    expect(JSON.stringify(options)).not.toContain('passwordHash');
    expect(JSON.stringify(options)).not.toContain('mfaSecret');
  });
});
