import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { BadgeService, AREA_LABELS } from './badge.service';
import { CertificateService } from './certificate.service';
import { UpdatePortfolioSettingsDto, CompetencyArea, CertificateStatus } from '@ai-interview/contracts';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly badgeService: BadgeService,
    private readonly certificateService: CertificateService,
  ) {}

  async getPublicPortfolio(username: string) {
    const portfolio = await this.prisma.publicPortfolio.findUnique({
      where: { username },
      include: {
        user: {
          include: {
            profile: true,
            userBadges: true,
            certificates: {
              where: { status: CertificateStatus.ISSUED },
              orderBy: { createdAt: 'desc' },
            },
            readinessSnapshots: {
              orderBy: { snapshotDate: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!portfolio || !portfolio.isPublic) {
      throw new NotFoundException(`Public portfolio for @${username} was not found or is private.`);
    }

    // Increment view count
    await this.prisma.publicPortfolio.update({
      where: { id: portfolio.id },
      data: { viewCount: { increment: 1 } },
    });

    const user = portfolio.user;
    const profile = user.profile;

    // Build skills data if enabled
    let skills: Array<{ area: CompetencyArea; name: string; score: number; evidenceCount: number }> | undefined;
    if (portfolio.showSkills) {
      const badgeProgress = await this.badgeService.getUserBadgeProgress(user.id);
      skills = badgeProgress.map((bp) => ({
        area: bp.competencyArea,
        name: bp.areaName,
        score: bp.currentScore,
        evidenceCount: bp.evidenceCount,
      }));
    }

    // Build badges data if enabled
    let badges = undefined;
    if (portfolio.showBadges) {
      badges = user.userBadges.map((b) => ({
        id: b.id,
        userId: b.userId,
        competencyArea: b.competencyArea,
        level: b.level,
        score: b.score,
        evidenceCount: b.evidenceCount,
        earnedAt: b.earnedAt.toISOString(),
      }));
    }

    // Build certificates data if enabled
    let certificates = undefined;
    if (portfolio.showCertificates) {
      certificates = user.certificates.map((c) => ({
        id: c.id,
        userId: c.userId,
        competencyArea: c.competencyArea,
        type: c.type,
        score: c.score,
        tierSlug: c.tierSlug,
        status: c.status,
        signatureHash: c.signatureHash,
        fileUrl: c.fileUrl,
        qrCodeUrl: c.qrCodeUrl,
        issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
        revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
        revokeReason: c.revokeReason,
        downloadCount: c.downloadCount,
        verifyCount: c.verifyCount,
        createdAt: c.createdAt.toISOString(),
      }));
    }

    // Build history highlights if enabled
    let historyHighlights = undefined;
    if (portfolio.showHistory) {
      const recentSessions = await this.prisma.interviewSession.findMany({
        where: { userId: user.id, state: 'COMPLETED' },
        include: { jobRole: true },
        orderBy: { completedAt: 'desc' },
        take: 5,
      });

      historyHighlights = recentSessions.map((s) => ({
        sessionId: s.id,
        roleName: s.jobRole.name,
        score: s.overallScore || 0,
        completedAt: s.completedAt ? s.completedAt.toISOString() : s.updatedAt.toISOString(),
      }));
    }

    const latestReadiness = user.readinessSnapshots[0];

    return {
      username: portfolio.username,
      displayName: portfolio.displayName || (portfolio.showRealName ? profile?.fullName : null) || portfolio.username,
      realName: portfolio.showRealName ? profile?.fullName || null : null,
      bio: portfolio.showBio ? portfolio.customBio || profile?.bio || null : null,
      viewCount: portfolio.viewCount + 1,
      memberSince: user.createdAt.toISOString(),
      skills,
      badges,
      certificates,
      historyHighlights,
      readinessSummary: latestReadiness
        ? {
            readinessScore: latestReadiness.readinessScore,
            tierName: latestReadiness.tierSlug.toUpperCase(),
          }
        : null,
    };
  }

  async getUserPortfolioSettings(userId: string) {
    let portfolio = await this.prisma.publicPortfolio.findUnique({
      where: { userId },
    });

    if (!portfolio) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      const baseUsername = user?.profile?.fullName
        ? user.profile.fullName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)
        : user?.email.split('@')[0].replace(/[^a-z0-9]/g, '_').slice(0, 20) || `user_${userId.slice(0, 8)}`;

      // ensure uniqueness
      let candidateUsername = baseUsername;
      const existing = await this.prisma.publicPortfolio.findUnique({
        where: { username: candidateUsername },
      });
      if (existing) {
        candidateUsername = `${baseUsername}_${userId.slice(0, 4)}`;
      }

      portfolio = await this.prisma.publicPortfolio.create({
        data: {
          userId,
          username: candidateUsername,
          displayName: user?.profile?.fullName || null,
          isPublic: false,
          showRealName: true,
          showBio: true,
          showSkills: true,
          showBadges: true,
          showCertificates: true,
          showHistory: false,
        },
      });
    }

    return portfolio;
  }

  async updatePortfolioSettings(userId: string, dto: UpdatePortfolioSettingsDto) {
    await this.getUserPortfolioSettings(userId);

    if (dto.username) {
      const existing = await this.prisma.publicPortfolio.findUnique({
        where: { username: dto.username },
      });

      if (existing && existing.userId !== userId) {
        throw new BadRequestException(`Username "${dto.username}" is already taken.`);
      }
    }

    const updated = await this.prisma.publicPortfolio.update({
      where: { userId },
      data: {
        ...(dto.username && { username: dto.username }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.showRealName !== undefined && { showRealName: dto.showRealName }),
        ...(dto.showBio !== undefined && { showBio: dto.showBio }),
        ...(dto.showSkills !== undefined && { showSkills: dto.showSkills }),
        ...(dto.showBadges !== undefined && { showBadges: dto.showBadges }),
        ...(dto.showCertificates !== undefined && { showCertificates: dto.showCertificates }),
        ...(dto.showHistory !== undefined && { showHistory: dto.showHistory }),
        ...(dto.customBio !== undefined && { customBio: dto.customBio }),
      },
    });

    return updated;
  }
}
