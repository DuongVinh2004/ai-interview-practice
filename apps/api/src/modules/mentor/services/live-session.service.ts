import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { MediaProvider } from '../providers/media-provider.interface';
import { LiveSessionStatus } from '@ai-interview/contracts';

@Injectable()
export class LiveSessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('MEDIA_PROVIDER') private readonly mediaProvider: MediaProvider,
  ) {}

  async joinSession(sessionId: string, userId: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        mentor: { include: { user: { include: { profile: true } } } },
        candidate: { include: { profile: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    const isMentor = session.mentor.userId === userId;
    const isCandidate = session.candidateId === userId;

    if (!isMentor && !isCandidate) {
      throw new ForbiddenException('You are not a participant in this live session');
    }

    if (session.status === LiveSessionStatus.CANCELED) {
      throw new BadRequestException('This session has been canceled');
    }

    const role: 'MENTOR' | 'CANDIDATE' = isMentor ? 'MENTOR' : 'CANDIDATE';
    const participantName = isMentor
      ? session.mentor.user.profile?.fullName || session.mentor.user.email.split('@')[0]
      : session.candidate.profile?.fullName || session.candidate.email.split('@')[0];

    const roomInfo = await this.mediaProvider.createRoom(sessionId);
    const roomToken = await this.mediaProvider.generateToken(
      sessionId,
      userId,
      role,
      participantName,
    );

    // Save token if not present
    if (!session.roomToken) {
      await this.prisma.liveSession.update({
        where: { id: sessionId },
        data: { roomToken },
      });
    }

    return {
      sessionId: session.id,
      roomToken,
      roomName: roomInfo.roomName,
      role,
      participantName,
      status: session.status,
    };
  }

  async startSession(sessionId: string, userId: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: { mentor: true },
    });

    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    if (session.mentor.userId !== userId) {
      throw new ForbiddenException('Only the mentor can start the session');
    }

    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        status: LiveSessionStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    return updated;
  }

  async endSession(sessionId: string, userId: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: { mentor: true },
    });

    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    if (session.mentor.userId !== userId) {
      throw new ForbiddenException('Only the mentor can end the session');
    }

    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        status: LiveSessionStatus.COMPLETED,
        endedAt: new Date(),
      },
    });

    // Increment mentor total sessions
    await this.prisma.mentorProfile.update({
      where: { id: session.mentorId },
      data: { totalSessions: { increment: 1 } },
    });

    return updated;
  }

  async saveMentorNotes(sessionId: string, userId: string, notes: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: { mentor: true },
    });

    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    if (session.mentor.userId !== userId) {
      throw new ForbiddenException('Only the mentor can edit private notes');
    }

    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { mentorNotes: notes },
    });

    return {
      sessionId: updated.id,
      mentorNotes: updated.mentorNotes,
      updatedAt: updated.updatedAt,
    };
  }

  async overrideScore(
    evaluationId: string,
    mentorUserId: string,
    newScore: number,
    justification: string,
  ) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        answer: {
          include: {
            turn: {
              include: {
                session: true,
              },
            },
          },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation record not found');
    }

    // Verify mentor identity
    const mentorProfile = await this.prisma.mentorProfile.findUnique({
      where: { userId: mentorUserId },
    });

    if (!mentorProfile) {
      throw new ForbiddenException('Only registered mentors can perform score overrides');
    }

    const candidateUserId = evaluation.answer.turn.session.userId;
    const assignment = await this.prisma.liveSession.findFirst({
      where: {
        mentorId: mentorProfile.id,
        candidateId: candidateUserId,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        "You are not the designated mentor for this candidate's session",
      );
    }

    const originalScore = evaluation.score;

    // Update evaluation score with appended justification audit in feedback
    const auditFeedback = `${evaluation.conciseFeedback}\n\n[Mentor Score Override (${new Date().toISOString()}): Original: ${originalScore} -> Adjusted: ${newScore}. Reason: ${justification}]`;
    const sessionId = evaluation.answer.turn.sessionId;

    const updated = await this.prisma.$transaction(async tx => {
      const updatedEval = await tx.evaluation.update({
        where: { id: evaluationId },
        data: {
          score: newScore,
          conciseFeedback: auditFeedback,
        },
      });

      const allEvaluations = await tx.evaluation.findMany({
        where: {
          answer: { turn: { sessionId } },
        },
      });

      if (allEvaluations.length > 0) {
        const avgScore =
          allEvaluations.reduce((sum, e) => sum + e.score, 0) / allEvaluations.length;
        await tx.interviewSession.update({
          where: { id: sessionId },
          data: { overallScore: Number(avgScore.toFixed(1)) },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: mentorUserId,
          action: 'EVALUATION_OVERRIDDEN',
          resource: 'evaluation',
          resourceId: evaluationId,
          details: { originalScore, newScore, justification, mentorId: mentorProfile.id },
        },
      });

      return updatedEval;
    });

    return {
      evaluationId: updated.id,
      originalScore,
      newScore: updated.score,
      justification,
      overriddenByMentorId: mentorProfile.id,
      updatedAt: new Date(),
    };
  }

  async rateMentor(sessionId: string, candidateId: string, rating: number, feedback?: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.candidateId !== candidateId) {
      throw new ForbiddenException('Only candidate can rate this session');
    }

    await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { candidateRating: rating },
    });

    // Re-compute average mentor rating
    const ratedSessions = await this.prisma.liveSession.findMany({
      where: {
        mentorId: session.mentorId,
        candidateRating: { not: null },
      },
    });

    if (ratedSessions.length > 0) {
      const avg =
        ratedSessions.reduce((sum, s) => sum + (s.candidateRating || 0), 0) / ratedSessions.length;
      await this.prisma.mentorProfile.update({
        where: { id: session.mentorId },
        data: { rating: Number(avg.toFixed(1)) },
      });
    }

    return {
      sessionId,
      candidateRating: rating,
      message: 'Thank you for your feedback!',
    };
  }
}
