import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { MediaProvider } from '../providers/media-provider.interface';
import { LiveSessionStatus } from '@ai-interview/contracts';
import { MentorAuthorityPolicy } from '../policies/mentor-authority.policy';

@Injectable()
export class LiveSessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('MEDIA_PROVIDER') private readonly mediaProvider: MediaProvider,
    private readonly mentorAuthorityPolicy: MentorAuthorityPolicy,
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

    if (isMentor) {
      await this.mentorAuthorityPolicy.requireApprovedByUser(userId);
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
    await this.mentorAuthorityPolicy.requireApprovedByUser(userId);

    const transition = await this.prisma.liveSession.updateMany({
      where: { id: sessionId, status: LiveSessionStatus.SCHEDULED },
      data: {
        status: LiveSessionStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });
    if (transition.count !== 1) {
      throw new ConflictException('Only a scheduled live session can be started');
    }

    return this.prisma.liveSession.findUnique({ where: { id: sessionId } });
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
    await this.mentorAuthorityPolicy.requireApprovedByUser(userId);

    const transition = await this.prisma.liveSession.updateMany({
      where: {
        id: sessionId,
        status: LiveSessionStatus.IN_PROGRESS,
        startedAt: { not: null },
      },
      data: {
        status: LiveSessionStatus.COMPLETED,
        endedAt: new Date(),
      },
    });
    if (transition.count !== 1) {
      throw new ConflictException('Only an in-progress live session can be completed');
    }

    // Increment mentor total sessions
    await this.prisma.mentorProfile.update({
      where: { id: session.mentorId },
      data: { totalSessions: { increment: 1 } },
    });

    return this.prisma.liveSession.findUnique({ where: { id: sessionId } });
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
    await this.mentorAuthorityPolicy.requireApprovedByUser(userId);

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
    // 1. Validate score bounds and justification
    if (typeof newScore !== 'number' || isNaN(newScore) || newScore < 0 || newScore > 10) {
      throw new BadRequestException('Score must be a number between 0.0 and 10.0');
    }

    if (!justification || typeof justification !== 'string' || justification.trim().length < 5) {
      throw new BadRequestException(
        'A valid justification of at least 5 characters is required for score override',
      );
    }

    const runOverride = () =>
      this.prisma.$transaction(
        async tx => {
          const evaluation = await tx.evaluation.findUnique({
            where: { id: evaluationId },
            include: {
              answer: {
                include: {
                  turn: {
                    include: { session: true },
                  },
                },
              },
            },
          });
          if (!evaluation) {
            throw new NotFoundException('Evaluation record not found');
          }

          const mentorProfile = await this.mentorAuthorityPolicy.requireApprovedByUser(
            mentorUserId,
            tx,
          );
          const candidateUserId = evaluation.answer.turn.session.userId;
          const sessionId = evaluation.answer.turn.sessionId;
          const engagement = await tx.liveSession.findFirst({
            where: {
              mentorId: mentorProfile.id,
              candidateId: candidateUserId,
              interviewId: sessionId,
              status: {
                in: [LiveSessionStatus.IN_PROGRESS, LiveSessionStatus.COMPLETED],
              },
            },
          });
          if (!engagement) {
            throw new ForbiddenException(
              'An exact active mentor, candidate, and interview engagement is required',
            );
          }

          const overrideWindowMs = 48 * 60 * 60 * 1000;
          if (engagement.status === LiveSessionStatus.COMPLETED) {
            const endedAt = engagement.endedAt ? new Date(engagement.endedAt).getTime() : NaN;
            const now = Date.now();
            if (!Number.isFinite(endedAt) || endedAt > now || now - endedAt > overrideWindowMs) {
              throw new ForbiddenException(
                'Mentor score override window has expired for this live session (48-hour limit)',
              );
            }
          }

          const originalScore = evaluation.score;
          const normalizedJustification = justification.trim();
          const auditFeedback = `${evaluation.conciseFeedback}\n\n[Mentor Score Override (${new Date().toISOString()}): Original: ${originalScore} -> Adjusted: ${newScore}. Reason: ${normalizedJustification}]`;
          const mentorEvidence = [
            ...(Array.isArray(evaluation.evidence) ? (evaluation.evidence as string[]) : []),
            `Authorized mentor review: ${normalizedJustification}`,
          ];
          const lastRun = await tx.evaluationRun.findFirst({
            where: { evaluationId },
            orderBy: { runNumber: 'desc' },
          });
          const run = await tx.evaluationRun.create({
            data: {
              evaluationId,
              runNumber: (lastRun?.runNumber || 0) + 1,
              score: newScore,
              rubricScores: evaluation.rubricScores as any,
              strengths: evaluation.strengths as any,
              improvements: evaluation.improvements as any,
              conciseFeedback: auditFeedback,
              evidence: mentorEvidence,
              needsReview: false,
              authorityState: 'AUTHORITATIVE',
              provider: 'mentor-review',
              fallbackReason: `Mentor override: ${normalizedJustification}`,
              confidence: 1.0,
              triggeredBy: 'MENTOR_OVERRIDE',
            },
          });
          const updatedEvaluation = await tx.evaluation.update({
            where: { id: evaluationId },
            data: {
              score: newScore,
              conciseFeedback: auditFeedback,
              evidence: mentorEvidence,
              needsReview: false,
              authorityState: 'AUTHORITATIVE',
              provider: 'mentor-review',
              currentRunId: run.id,
            },
          });

          const allEvaluations = await tx.evaluation.findMany({
            where: {
              answer: { turn: { sessionId } },
              authorityState: 'AUTHORITATIVE',
              needsReview: false,
            },
          });
          if (allEvaluations.length > 0) {
            const avgScore =
              allEvaluations.reduce((sum, current) => sum + current.score, 0) /
              allEvaluations.length;
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
              details: {
                engagementId: engagement.id,
                mentorId: mentorProfile.id,
                candidateId: candidateUserId,
                interviewId: sessionId,
                previousScore: originalScore,
                newScore,
                reason: normalizedJustification,
              },
            },
          });

          return {
            evaluationId: updatedEvaluation.id,
            originalScore,
            newScore: updatedEvaluation.score,
            justification: normalizedJustification,
            overriddenByMentorId: mentorProfile.id,
            engagementId: engagement.id,
            updatedAt: new Date(),
          };
        },
        { isolationLevel: 'Serializable' },
      );

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await runOverride();
      } catch (error: any) {
        const retryable = error?.code === 'P2034' || error?.code === 'P2002';
        if (!retryable || attempt === 3) {
          throw error;
        }
      }
    }
    throw new ConflictException('Score override could not be serialized');
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
