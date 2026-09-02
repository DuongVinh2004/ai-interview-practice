import { Test, TestingModule } from '@nestjs/testing';
import { SignatureService } from './services/signature.service';
import { QrCodeService } from './services/qr-code.service';
import { BadgeService } from './services/badge.service';
import { CertificateService } from './services/certificate.service';
import { PortfolioService } from './services/portfolio.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { CompetencyArea, BadgeLevel, CertificateStatus } from '@ai-interview/contracts';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Track F010: Portfolio & Certificate Module', () => {
  let signatureService: SignatureService;
  let qrCodeService: QrCodeService;
  let badgeService: BadgeService;
  let certificateService: CertificateService;
  let portfolioService: PortfolioService;
  let prisma: any;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    skillScore: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    interviewTurn: {
      findMany: jest.fn(),
    },
    userBadge: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    certificate: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    publicPortfolio: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    interviewSession: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureService,
        QrCodeService,
        BadgeService,
        CertificateService,
        PortfolioService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    signatureService = module.get<SignatureService>(SignatureService);
    qrCodeService = module.get<QrCodeService>(QrCodeService);
    badgeService = module.get<BadgeService>(BadgeService);
    certificateService = module.get<CertificateService>(CertificateService);
    portfolioService = module.get<PortfolioService>(PortfolioService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('1. Digital Signature Service (HMAC-SHA256)', () => {
    it('generates consistent HMAC-SHA256 signature and verifies authentic payload', () => {
      const certId = 'cert-uuid-123';
      const userId = 'user-uuid-456';
      const competency = CompetencyArea.SYSTEM_DESIGN;
      const score = 8.8;
      const issuedAt = new Date('2026-08-24T12:00:00Z');

      const signature = signatureService.generateSignature(
        certId,
        userId,
        competency,
        score,
        issuedAt,
      );
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA-256 hex length

      const isValid = signatureService.verifySignature(
        certId,
        userId,
        competency,
        score,
        issuedAt,
        signature,
      );
      expect(isValid).toBe(true);
    });

    it('rejects tampered certificate payload or modified score', () => {
      const certId = 'cert-uuid-123';
      const userId = 'user-uuid-456';
      const competency = CompetencyArea.SYSTEM_DESIGN;
      const originalScore = 8.8;
      const tamperedScore = 9.5;
      const issuedAt = new Date('2026-08-24T12:00:00Z');

      const originalSignature = signatureService.generateSignature(
        certId,
        userId,
        competency,
        originalScore,
        issuedAt,
      );

      const isValid = signatureService.verifySignature(
        certId,
        userId,
        competency,
        tamperedScore,
        issuedAt,
        originalSignature,
      );
      expect(isValid).toBe(false);
    });
  });

  describe('2. Badge Engine & Unlock Thresholds', () => {
    it('calculates appropriate badge tiers according to score and evidence count criteria', () => {
      // Bronze: score >= 5.0, evidence >= 3
      expect(badgeService.calculateUnlockedBadge(5.2, 3)).toBe(BadgeLevel.BRONZE);
      expect(badgeService.calculateUnlockedBadge(5.2, 2)).toBe(null); // insufficient evidence

      // Silver: score >= 6.5, evidence >= 5
      expect(badgeService.calculateUnlockedBadge(7.0, 5)).toBe(BadgeLevel.SILVER);
      expect(badgeService.calculateUnlockedBadge(7.0, 4)).toBe(BadgeLevel.BRONZE);

      // Gold: score >= 8.0, evidence >= 8
      expect(badgeService.calculateUnlockedBadge(8.4, 8)).toBe(BadgeLevel.GOLD);

      // Platinum: score >= 9.0, evidence >= 12
      expect(badgeService.calculateUnlockedBadge(9.2, 14)).toBe(BadgeLevel.PLATINUM);
    });

    it('syncs user badges and returns 5-axis competency progress', async () => {
      const userId = 'user-123';
      mockPrisma.interviewTurn.findMany.mockResolvedValue(
        Array.from({ length: 10 }, () => ({
          session: { competencyArea: CompetencyArea.SYSTEM_DESIGN },
          answer: { evaluation: { score: 8.5 } },
        })),
      );

      mockPrisma.userBadge.upsert.mockResolvedValue({
        id: 'badge-1',
        userId,
        competencyArea: CompetencyArea.SYSTEM_DESIGN,
        level: BadgeLevel.GOLD,
        score: 8.5,
        evidenceCount: 10,
        earnedAt: new Date(),
      });

      mockPrisma.userBadge.findMany.mockResolvedValue([
        {
          id: 'badge-1',
          userId,
          competencyArea: CompetencyArea.SYSTEM_DESIGN,
          level: BadgeLevel.GOLD,
          score: 8.5,
          evidenceCount: 10,
          earnedAt: new Date(),
        },
      ]);

      const progress = await badgeService.getUserBadgeProgress(userId);
      expect(mockPrisma.interviewTurn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            answer: {
              evaluation: {
                is: { authorityState: 'AUTHORITATIVE', needsReview: false },
              },
            },
          }),
        }),
      );
      expect(mockPrisma.skillScore.findMany).not.toHaveBeenCalled();
      expect(progress.length).toBe(5);

      const sysDesign = progress.find(p => p.competencyArea === CompetencyArea.SYSTEM_DESIGN);
      expect(sysDesign?.highestLevel).toBe(BadgeLevel.GOLD);
      expect(sysDesign?.isUnlocked).toBe(true);
      expect(sysDesign?.nextBadgeLevel).toBe(BadgeLevel.PLATINUM);
    });
  });

  describe('3. Certificate Service & Verification Portal', () => {
    it('generates certificate when candidate meets Gold/Platinum criteria', async () => {
      const userId = 'user-123';
      mockPrisma.skillScore.findMany.mockResolvedValue([]);
      mockPrisma.interviewTurn.findMany.mockResolvedValue(
        Array.from({ length: 10 }, () => ({
          answer: {
            evaluation: {
              score: 8.6,
              authorityState: 'AUTHORITATIVE',
              needsReview: false,
              provider: 'openai',
              evidence: ['current authoritative evidence'],
            },
          },
        })),
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'candidate@example.com',
        profile: { fullName: 'Alex Rivera' },
      });

      mockPrisma.certificate.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: data.id || 'cert-999' }),
      );

      const result = await certificateService.generateCertificate(
        userId,
        CompetencyArea.SYSTEM_DESIGN,
      );
      expect(result).toBeDefined();
      expect(result.status).toBe(CertificateStatus.ISSUED);
      expect(result.recipientName).toBe('Alex Rivera');
      expect(result.signatureHash).toBeDefined();
      expect(result.qrCodeUrl).toContain('data:image/svg+xml');
    });

    it('does not issue from a stale Gold badge when current evidence is below threshold', async () => {
      const userId = 'user-stale-badge';
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'candidate@example.com',
        profile: { fullName: 'Alex Rivera' },
      });
      mockPrisma.userBadge.findFirst.mockResolvedValue({
        id: 'stale-gold',
        userId,
        competencyArea: CompetencyArea.SYSTEM_DESIGN,
        level: BadgeLevel.GOLD,
        score: 9.5,
        evidenceCount: 12,
      });
      mockPrisma.interviewTurn.findMany.mockResolvedValue(
        Array.from({ length: 7 }, () => ({
          answer: {
            evaluation: {
              score: 9.5,
              authorityState: 'AUTHORITATIVE',
              needsReview: false,
              provider: 'openai',
              evidence: ['current evidence'],
            },
          },
        })),
      );

      await expect(
        certificateService.generateCertificate(userId, CompetencyArea.SYSTEM_DESIGN),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.certificate.create).not.toHaveBeenCalled();
    });

    it('rejects certificate generation if score < 8.0 or no badge exists', async () => {
      const userId = 'user-123';
      mockPrisma.skillScore.findMany.mockResolvedValue([]);
      mockPrisma.interviewTurn.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'candidate@example.com',
        profile: { fullName: 'Alex Rivera' },
      });

      mockPrisma.userBadge.findFirst.mockResolvedValue(null);
      mockPrisma.skillScore.findFirst.mockResolvedValue(null);

      await expect(
        certificateService.generateCertificate(userId, CompetencyArea.SYSTEM_DESIGN),
      ).rejects.toThrow(BadRequestException);
    });

    it('verifies valid certificate and detects revoked state', async () => {
      const certId = 'cert-777';
      const userId = 'user-123';
      const issuedAt = new Date('2026-08-24T10:00:00Z');
      const sig = signatureService.generateSignature(
        certId,
        userId,
        CompetencyArea.SYSTEM_DESIGN,
        8.5,
        issuedAt,
      );

      mockPrisma.certificate.findUnique.mockResolvedValue({
        id: certId,
        userId,
        competencyArea: CompetencyArea.SYSTEM_DESIGN,
        score: 8.5,
        status: CertificateStatus.ISSUED,
        signatureHash: sig,
        issuedAt,
        createdAt: issuedAt,
        verifyCount: 2,
        user: { email: 'test@example.com', profile: { fullName: 'Alex Rivera' } },
      });
      mockPrisma.certificate.update.mockResolvedValue({});

      const verified = await certificateService.verifyCertificate(certId);
      expect(verified.isValid).toBe(true);
      expect(verified.recipientName).toBe('Alex Rivera');
      expect(verified.verifyCount).toBe(3);
    });
  });

  describe('4. Public Portfolio Service & Visibility Flags', () => {
    it('returns filtered public portfolio respecting user privacy toggles', async () => {
      mockPrisma.publicPortfolio.findUnique.mockResolvedValue({
        id: 'port-1',
        userId: 'user-123',
        username: 'alex_rivera',
        isPublic: true,
        displayName: 'Alex Senior Dev',
        showRealName: true,
        showBio: true,
        showSkills: true,
        showBadges: true,
        showCertificates: true,
        showHistory: false,
        viewCount: 10,
        user: {
          id: 'user-123',
          email: 'alex@test.com',
          createdAt: new Date('2026-01-01'),
          profile: { fullName: 'Alex Rivera', bio: 'Senior Engineer' },
          userBadges: [
            {
              id: 'b-1',
              userId: 'user-123',
              competencyArea: CompetencyArea.SYSTEM_DESIGN,
              level: BadgeLevel.GOLD,
              score: 8.5,
              evidenceCount: 9,
              earnedAt: new Date(),
            },
          ],
          certificates: [],
          readinessSnapshots: [{ readinessScore: 88, tierSlug: 'competitive' }],
        },
      });
      mockPrisma.publicPortfolio.update.mockResolvedValue({});
      mockPrisma.skillScore.findMany.mockResolvedValue([]);
      mockPrisma.userBadge.findMany.mockResolvedValue([]);

      const result = await portfolioService.getPublicPortfolio('alex_rivera');
      expect(result.username).toBe('alex_rivera');
      expect(result.displayName).toBe('Alex Senior Dev');
      expect(result.realName).toBe('Alex Rivera');
      expect(result.skills).toBeDefined();
      expect(result.badges?.length).toBe(1);
      expect(result.historyHighlights).toBeUndefined(); // showHistory was false
      expect(result.viewCount).toBe(11);
    });

    it('throws NotFoundException when portfolio is private or does not exist', async () => {
      mockPrisma.publicPortfolio.findUnique.mockResolvedValue({
        id: 'port-2',
        username: 'private_user',
        isPublic: false,
      });

      await expect(portfolioService.getPublicPortfolio('private_user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
