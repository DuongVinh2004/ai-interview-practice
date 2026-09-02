import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { LiveSessionStatus } from '@ai-interview/contracts';
import { MentorAuthorityPolicy } from '../policies/mentor-authority.policy';
import { Prisma } from '@prisma/client';

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mentorAuthorityPolicy: MentorAuthorityPolicy,
  ) {}

  async bookSession(
    candidateId: string,
    mentorId: string,
    scheduledAt: Date | string,
    interviewId?: string,
  ) {
    const bookingDate = new Date(scheduledAt);
    if (isNaN(bookingDate.getTime())) {
      throw new BadRequestException('Invalid scheduled date');
    }

    if (bookingDate <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    // 1. Verify mentor exists & is active
    await this.mentorAuthorityPolicy.requireApprovedById(mentorId);
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { id: mentorId },
      include: { user: { include: { profile: true } } },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor profile not found or inactive');
    }

    if (mentor.userId === candidateId) {
      throw new BadRequestException('You cannot book a mentoring session with yourself');
    }

    if (interviewId) {
      const interview = await this.prisma.interviewSession.findFirst({
        where: { id: interviewId, userId: candidateId },
        select: { id: true },
      });
      if (!interview) {
        throw new BadRequestException('Interview must exist and belong to the booking candidate');
      }
    }

    // 2. Collision Detection: 45-minute window before and after
    const windowStart = new Date(bookingDate.getTime() - 45 * 60 * 1000);
    const windowEnd = new Date(bookingDate.getTime() + 45 * 60 * 1000);

    let session: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        session = await this.prisma.$transaction(
          async tx => {
            const existingMentorBooking = await tx.liveSession.findFirst({
              where: {
                mentorId,
                status: { in: [LiveSessionStatus.SCHEDULED, LiveSessionStatus.IN_PROGRESS] },
                scheduledAt: { gte: windowStart, lte: windowEnd },
              },
            });
            if (existingMentorBooking) {
              throw new ConflictException(
                'Mentor is not available at this time slot (existing booking conflict).',
              );
            }

            const existingCandidateBooking = await tx.liveSession.findFirst({
              where: {
                candidateId,
                status: { in: [LiveSessionStatus.SCHEDULED, LiveSessionStatus.IN_PROGRESS] },
                scheduledAt: { gte: windowStart, lte: windowEnd },
              },
            });
            if (existingCandidateBooking) {
              throw new ConflictException(
                'You already have another live session scheduled around this time.',
              );
            }

            return tx.liveSession.create({
              data: {
                mentorId,
                candidateId,
                interviewId: interviewId || null,
                scheduledAt: bookingDate,
                status: LiveSessionStatus.SCHEDULED,
              },
              include: {
                mentor: { include: { user: { include: { profile: true } } } },
                candidate: { include: { profile: true } },
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt < 3) continue;
        if (error?.code === 'P2034') {
          throw new ConflictException('The mentoring slot was booked concurrently.');
        }
        throw error;
      }
    }

    return {
      id: session.id,
      mentorId: session.mentorId,
      mentorName: session.mentor.user.profile?.fullName || session.mentor.user.email.split('@')[0],
      candidateId: session.candidateId,
      candidateName: session.candidate.profile?.fullName || session.candidate.email.split('@')[0],
      scheduledAt: session.scheduledAt,
      status: session.status,
      createdAt: session.createdAt,
    };
  }

  async getMySessions(userId: string) {
    const sessions = await this.prisma.liveSession.findMany({
      where: {
        OR: [{ candidateId: userId }, { mentor: { userId } }],
      },
      include: {
        mentor: { include: { user: { include: { profile: true } } } },
        candidate: { include: { profile: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    return sessions.map(s => {
      const isMentor = s.mentor.userId === userId;
      return {
        id: s.id,
        mentorId: s.mentorId,
        mentorName: s.mentor.user.profile?.fullName || s.mentor.user.email.split('@')[0],
        candidateId: s.candidateId,
        candidateName: s.candidate.profile?.fullName || s.candidate.email.split('@')[0],
        scheduledAt: s.scheduledAt,
        status: s.status,
        mentorNotes: isMentor ? s.mentorNotes : undefined,
        candidateRating: s.candidateRating,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        createdAt: s.createdAt,
        isMentor,
      };
    });
  }

  async cancelSession(sessionId: string, userId: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: { mentor: true },
    });

    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    if (session.candidateId !== userId && session.mentor.userId !== userId) {
      throw new ForbiddenException('Access denied to cancel this session');
    }

    if (
      session.status === LiveSessionStatus.COMPLETED ||
      session.status === LiveSessionStatus.CANCELED
    ) {
      throw new BadRequestException(`Cannot cancel session with status ${session.status}`);
    }

    const transition = await this.prisma.liveSession.updateMany({
      where: {
        id: sessionId,
        status: { notIn: [LiveSessionStatus.COMPLETED, LiveSessionStatus.CANCELED] },
      },
      data: { status: LiveSessionStatus.CANCELED },
    });
    if (transition.count !== 1) {
      throw new ConflictException('Session entered a terminal state before cancellation.');
    }

    return this.prisma.liveSession.findUnique({ where: { id: sessionId } });
  }
}
