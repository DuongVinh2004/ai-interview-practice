import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import {
  ErrorCode,
  UserRole,
  AuditAction,
  ShareExpiryDuration,
  SessionState,
} from '@ai-interview/contracts';
import { CreateShareTokenDto, AddMentorFeedbackDto } from './dto/share.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a secure share link for an interview session
   */
  async createShareToken(userId: string, sessionId: string, dto: CreateShareTokenDto) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new DomainException(ErrorCode.SESSION_NOT_FOUND, 'Interview session not found', HttpStatus.NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'You do not own this interview session', HttpStatus.FORBIDDEN);
    }

    if (session.state !== SessionState.COMPLETED) {
      throw new DomainException(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Only completed interview sessions can be shared with mentors',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Calculate expiry date
    let expiresAt: Date | null = null;
    const now = new Date();
    if (dto.expiry === ShareExpiryDuration.ONE_DAY) {
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (dto.expiry === ShareExpiryDuration.SEVEN_DAYS) {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (dto.expiry === ShareExpiryDuration.THIRTY_DAYS) {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      expiresAt = null; // NEVER
    }

    const token = crypto.randomBytes(24).toString('hex');
    let passcodeHash: string | null = null;
    if (dto.passcode) {
      passcodeHash = await bcrypt.hash(dto.passcode, 10);
    }

    const shareToken = await this.prisma.shareToken.create({
      data: {
        sessionId,
        token,
        isAnonymized: dto.isAnonymized || false,
        expiresAt,
        passcodeHash,
      },
      include: {
        mentorFeedback: true,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.SHARE_LINK_CREATED,
        resource: 'share_token',
        resourceId: shareToken.id,
        details: {
          sessionId,
          expiresAt: expiresAt?.toISOString() || null,
          isAnonymized: dto.isAnonymized,
        },
      },
    });

    return {
      id: shareToken.id,
      sessionId: shareToken.sessionId,
      token: shareToken.token,
      shareUrl: `/share/${shareToken.token}`,
      isRevoked: shareToken.isRevoked,
      isAnonymized: shareToken.isAnonymized,
      expiresAt: shareToken.expiresAt?.toISOString() || null,
      viewCount: shareToken.viewCount,
      lastViewedAt: shareToken.lastViewedAt?.toISOString() || null,
      createdAt: shareToken.createdAt.toISOString(),
      mentorFeedback: shareToken.mentorFeedback.map(m => ({
        id: m.id,
        turnNumber: m.turnNumber,
        mentorName: m.mentorName,
        comment: m.comment,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Retrieves all share tokens generated for an interview session
   */
  async getSessionShareTokens(userId: string, sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new DomainException(ErrorCode.SESSION_NOT_FOUND, 'Interview session not found', HttpStatus.NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'You do not own this interview session', HttpStatus.FORBIDDEN);
    }

    const tokens = await this.prisma.shareToken.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      include: {
        mentorFeedback: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return tokens.map(t => ({
      id: t.id,
      sessionId: t.sessionId,
      token: t.token,
      shareUrl: `/share/${t.token}`,
      isRevoked: t.isRevoked,
      isAnonymized: t.isAnonymized,
      expiresAt: t.expiresAt?.toISOString() || null,
      viewCount: t.viewCount,
      lastViewedAt: t.lastViewedAt?.toISOString() || null,
      createdAt: t.createdAt.toISOString(),
      mentorFeedback: t.mentorFeedback.map(m => ({
        id: m.id,
        turnNumber: m.turnNumber,
        mentorName: m.mentorName,
        comment: m.comment,
        createdAt: m.createdAt.toISOString(),
      })),
    }));
  }

  /**
   * Revokes a share token so it can no longer be accessed
   */
  async revokeShareToken(userId: string, sessionId: string, tokenId: string) {
    const shareToken = await this.prisma.shareToken.findUnique({
      where: { id: tokenId },
      include: { session: true },
    });

    if (!shareToken || shareToken.sessionId !== sessionId) {
      throw new DomainException(ErrorCode.SHARE_LINK_NOT_FOUND, 'Share link not found', HttpStatus.NOT_FOUND);
    }

    if (shareToken.session.userId !== userId) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'You do not own this share link', HttpStatus.FORBIDDEN);
    }

    const updated = await this.prisma.shareToken.update({
      where: { id: tokenId },
      data: { isRevoked: true },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.SHARE_LINK_REVOKED,
        resource: 'share_token',
        resourceId: shareToken.id,
        details: { sessionId, token: shareToken.token },
      },
    });

    return {
      id: updated.id,
      isRevoked: updated.isRevoked,
      message: 'Share link has been revoked successfully',
    };
  }

  /**
   * Public (unauthenticated) endpoint for mentors to inspect a shared interview report
   */
  async getPublicSharedResult(token: string, passcode?: string) {
    const shareToken = await this.prisma.shareToken.findUnique({
      where: { token },
      include: {
        mentorFeedback: {
          orderBy: { createdAt: 'asc' },
        },
        session: {
          include: {
            user: {
              include: { profile: true },
            },
            jobRole: true,
            seniorityLevel: true,
            technologies: { include: { technology: true } },
            turns: {
              orderBy: { turnNumber: 'asc' },
              include: {
                question: true,
                answer: {
                  include: { evaluation: true },
                },
              },
            },
            learningPath: {
              include: {
                items: { orderBy: { order: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!shareToken) {
      throw new DomainException(ErrorCode.SHARE_LINK_NOT_FOUND, 'Shared interview link not found', HttpStatus.NOT_FOUND);
    }

    if (shareToken.isRevoked) {
      throw new DomainException(ErrorCode.SHARE_LINK_REVOKED, 'This shared interview link has been revoked by the candidate', HttpStatus.GONE);
    }

    if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
      throw new DomainException(ErrorCode.SHARE_LINK_EXPIRED, 'This shared interview link has expired', HttpStatus.GONE);
    }

    // Verify passcode if protected
    if (shareToken.passcodeHash) {
      if (!passcode) {
        throw new DomainException(ErrorCode.UNAUTHORIZED, 'Passcode required to view this interview report', HttpStatus.UNAUTHORIZED);
      }
      const isMatch = await bcrypt.compare(passcode, shareToken.passcodeHash);
      if (!isMatch) {
        throw new DomainException(ErrorCode.INVALID_CREDENTIALS, 'Invalid passcode for this interview report', HttpStatus.FORBIDDEN);
      }
    }

    // Increment view count asynchronously
    await this.prisma.shareToken.update({
      where: { id: shareToken.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });

    const session = shareToken.session;

    // Calculate rubric averages
    const turnsWithEval = session.turns.filter(t => t.answer?.evaluation);
    let avgAccuracy = 0;
    let avgDepth = 0;
    let avgClarity = 0;

    if (turnsWithEval.length > 0) {
      let totalAcc = 0;
      let totalDepth = 0;
      let totalClarity = 0;

      for (const t of turnsWithEval) {
        const rubric = t.answer!.evaluation!.rubricScores as any;
        if (rubric) {
          totalAcc += rubric.technicalAccuracy || 0;
          totalDepth += rubric.depth || 0;
          totalClarity += rubric.clarity || 0;
        }
      }

      avgAccuracy = Number((totalAcc / turnsWithEval.length).toFixed(1));
      avgDepth = Number((totalDepth / turnsWithEval.length).toFixed(1));
      avgClarity = Number((totalClarity / turnsWithEval.length).toFixed(1));
    }

    return {
      shareTokenId: shareToken.id,
      isAnonymized: shareToken.isAnonymized,
      expiresAt: shareToken.expiresAt?.toISOString() || null,
      viewCount: shareToken.viewCount + 1,
      createdAt: shareToken.createdAt.toISOString(),
      candidate: shareToken.isAnonymized
        ? {
            fullName: 'Anonymous Candidate',
            targetRole: session.jobRole.name,
            targetLevel: session.seniorityLevel.name,
          }
        : {
            fullName: session.user.profile?.fullName || 'Candidate',
            email: session.user.email,
            targetRole: session.user.profile?.targetRole || session.jobRole.name,
            targetLevel: session.user.profile?.targetLevel || session.seniorityLevel.name,
          },
      session: {
        id: session.id,
        state: session.state,
        overallScore: session.overallScore,
        completedAt: session.completedAt?.toISOString() || null,
        jobRole: session.jobRole,
        seniorityLevel: session.seniorityLevel,
        technologies: session.technologies.map(t => t.technology),
        rubricAverages: {
          technicalAccuracy: avgAccuracy,
          depth: avgDepth,
          clarity: avgClarity,
        },
        turns: session.turns.map(t => ({
          turnNumber: t.turnNumber,
          difficulty: t.difficulty,
          status: t.status,
          question: t.question
            ? {
                content: t.question.content,
                keyFocus: t.question.keyFocus,
              }
            : null,
          answer: t.answer
            ? {
                content: t.answer.content,
                submittedAt: t.answer.submittedAt.toISOString(),
                evaluation: t.answer.evaluation
                  ? {
                      score: t.answer.evaluation.score,
                      rubricScores: t.answer.evaluation.rubricScores,
                      strengths: t.answer.evaluation.strengths,
                      improvements: t.answer.evaluation.improvements,
                      conciseFeedback: t.answer.evaluation.conciseFeedback,
                      evidence: t.answer.evaluation.evidence,
                    }
                  : null,
              }
            : null,
        })),
        learningPath: session.learningPath
          ? {
              id: session.learningPath.id,
              status: session.learningPath.status,
              summary: session.learningPath.summary,
              items: session.learningPath.items.map(item => ({
                id: item.id,
                gap: item.gap,
                topic: item.topic,
                priority: item.priority,
                recommendedAction: item.recommendedAction,
                searchKeywords: item.searchKeywords,
                order: item.order,
              })),
            }
          : null,
      },
      mentorFeedback: shareToken.mentorFeedback.map(m => ({
        id: m.id,
        turnNumber: m.turnNumber,
        mentorName: m.mentorName,
        comment: m.comment,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Adds mentor commentary or annotations to a shared session
   */
  async addMentorFeedback(token: string, dto: AddMentorFeedbackDto) {
    const shareToken = await this.prisma.shareToken.findUnique({
      where: { token },
    });

    if (!shareToken) {
      throw new DomainException(ErrorCode.SHARE_LINK_NOT_FOUND, 'Shared interview link not found', HttpStatus.NOT_FOUND);
    }

    if (shareToken.isRevoked) {
      throw new DomainException(ErrorCode.SHARE_LINK_REVOKED, 'This share link has been revoked', HttpStatus.GONE);
    }

    if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
      throw new DomainException(ErrorCode.SHARE_LINK_EXPIRED, 'This share link has expired', HttpStatus.GONE);
    }

    const feedback = await this.prisma.mentorFeedback.create({
      data: {
        shareTokenId: shareToken.id,
        turnNumber: dto.turnNumber || null,
        mentorName: dto.mentorName.trim(),
        comment: dto.comment.trim(),
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.MENTOR_FEEDBACK_SUBMITTED,
        resource: 'mentor_feedback',
        resourceId: feedback.id,
        details: {
          shareTokenId: shareToken.id,
          turnNumber: dto.turnNumber,
          mentorName: dto.mentorName,
        },
      },
    });

    return {
      id: feedback.id,
      turnNumber: feedback.turnNumber,
      mentorName: feedback.mentorName,
      comment: feedback.comment,
      createdAt: feedback.createdAt.toISOString(),
    };
  }

  /**
   * Exports full session report in JSON format
   */
  async exportSessionJson(userId: string, userRole: UserRole, sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { include: { profile: true } },
        jobRole: true,
        seniorityLevel: true,
        technologies: { include: { technology: true } },
        turns: {
          orderBy: { turnNumber: 'asc' },
          include: {
            question: true,
            answer: { include: { evaluation: true } },
          },
        },
        learningPath: {
          include: { items: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!session) {
      throw new DomainException(ErrorCode.SESSION_NOT_FOUND, 'Interview session not found', HttpStatus.NOT_FOUND);
    }

    if (session.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new DomainException(ErrorCode.FORBIDDEN, 'Access denied', HttpStatus.FORBIDDEN);
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.SESSION_DATA_EXPORTED,
        resource: 'interview_session',
        resourceId: sessionId,
        details: { format: 'json' },
      },
    });

    return {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      session: {
        id: session.id,
        state: session.state,
        overallScore: session.overallScore,
        createdAt: session.createdAt.toISOString(),
        completedAt: session.completedAt?.toISOString() || null,
        jobRole: session.jobRole.name,
        seniorityLevel: session.seniorityLevel.name,
        technologies: session.technologies.map(t => t.technology.name),
        candidate: {
          fullName: session.user.profile?.fullName || 'Candidate',
          email: session.user.email,
        },
        turns: session.turns.map(t => ({
          turnNumber: t.turnNumber,
          difficulty: t.difficulty,
          question: t.question?.content || null,
          keyFocus: t.question?.keyFocus || null,
          answer: t.answer?.content || null,
          evaluation: t.answer?.evaluation
            ? {
                score: t.answer.evaluation.score,
                rubricScores: t.answer.evaluation.rubricScores,
                strengths: t.answer.evaluation.strengths,
                improvements: t.answer.evaluation.improvements,
                conciseFeedback: t.answer.evaluation.conciseFeedback,
                evidence: t.answer.evaluation.evidence,
              }
            : null,
        })),
        learningPath: session.learningPath
          ? {
              summary: session.learningPath.summary,
              items: session.learningPath.items.map(item => ({
                gap: item.gap,
                topic: item.topic,
                priority: item.priority,
                recommendedAction: item.recommendedAction,
                searchKeywords: item.searchKeywords,
              })),
            }
          : null,
      },
    };
  }
}
