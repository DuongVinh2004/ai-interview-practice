import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { SignatureService } from './signature.service';
import { QrCodeService } from './qr-code.service';
import { BadgeService } from './badge.service';
import { CompetencyArea, CertificateStatus, BadgeLevel } from '@ai-interview/contracts';
import { v4 as uuidv4 } from 'uuid';
import { isPersistedAuthoritativeEvaluation } from '../../evaluation/evaluation-authority';

@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signatureService: SignatureService,
    private readonly qrCodeService: QrCodeService,
    private readonly badgeService: BadgeService,
  ) {}

  async generateCertificate(
    userId: string,
    competencyArea?: CompetencyArea,
    type: string = 'COMPETENCY',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const area = competencyArea || CompetencyArea.SYSTEM_DESIGN;

    // Badges are a cache/materialized view and may be stale or manually
    // inserted. Recompute the credential threshold from current authoritative
    // evidence at issuance time; a stale Gold badge must never qualify alone.
    const turns = await this.prisma.interviewTurn.findMany({
      where: {
        status: 'EVALUATED',
        session: { userId, competencyArea: area },
        answer: {
          evaluation: {
            is: {
              authorityState: 'AUTHORITATIVE',
              needsReview: false,
            },
          },
        },
      },
      include: { answer: { include: { evaluation: true } } },
    });

    const authoritativeEvaluations = turns
      .map(turn => turn.answer?.evaluation)
      .filter((evaluation): evaluation is NonNullable<typeof evaluation> =>
        isPersistedAuthoritativeEvaluation(evaluation),
      );
    const evidenceCount = authoritativeEvaluations.length;
    const score =
      evidenceCount > 0
        ? authoritativeEvaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) /
          evidenceCount
        : 0;
    const currentLevel = this.badgeService.calculateUnlockedBadge(score, evidenceCount);

    if (currentLevel !== BadgeLevel.GOLD && currentLevel !== BadgeLevel.PLATINUM) {
      throw new BadRequestException(
        'Certificate issuance requires current authoritative evidence meeting the Gold threshold.',
      );
    }

    const certId = uuidv4();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

    // 3. Generate HMAC-SHA256 signature
    const signatureHash = this.signatureService.generateSignature(
      certId,
      userId,
      area,
      score,
      issuedAt,
    );

    // 4. Generate QR code
    const qrCodeUrl = this.qrCodeService.generateQrCodeDataUrl(certId);
    const mockFileUrl = `/api/v1/certificates/${certId}/download`;

    // 5. Store in database
    const certificate = await this.prisma.certificate.create({
      data: {
        id: certId,
        userId,
        competencyArea: area,
        type,
        score: Number(score.toFixed(1)),
        status: CertificateStatus.ISSUED,
        signatureHash,
        fileUrl: mockFileUrl,
        qrCodeUrl,
        issuedAt,
        expiresAt,
      },
    });

    return {
      ...certificate,
      recipientName: user.profile?.fullName || user.email.split('@')[0],
      verificationUrl: this.qrCodeService.getVerificationUrl(certId),
    };
  }

  async verifyCertificate(certId: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certId },
      include: {
        user: { include: { profile: true } },
      },
    });

    if (!cert) {
      return {
        isValid: false,
        status: CertificateStatus.REVOKED,
        certId,
        recipientName: 'Unknown',
        score: 0,
        signatureHash: '',
        verifyCount: 0,
        message: 'Certificate ID does not exist in registry.',
      };
    }

    // Increment verify count
    await this.prisma.certificate.update({
      where: { id: certId },
      data: { verifyCount: { increment: 1 } },
    });

    // Check if expired
    const isExpired = cert.expiresAt && new Date() > new Date(cert.expiresAt);
    if (isExpired && cert.status === CertificateStatus.ISSUED) {
      await this.prisma.certificate.update({
        where: { id: certId },
        data: { status: CertificateStatus.EXPIRED },
      });
      cert.status = CertificateStatus.EXPIRED;
    }

    // Cryptographic signature integrity validation
    const area = cert.competencyArea || CompetencyArea.SYSTEM_DESIGN;
    const isSignatureValid = this.signatureService.verifySignature(
      cert.id,
      cert.userId,
      area,
      cert.score,
      cert.issuedAt || cert.createdAt,
      cert.signatureHash,
    );

    const isAuthentic = isSignatureValid && cert.status === CertificateStatus.ISSUED;

    return {
      isValid: isAuthentic,
      status: cert.status,
      certId: cert.id,
      recipientName: cert.user.profile?.fullName || cert.user.email.split('@')[0],
      competencyArea: cert.competencyArea,
      score: cert.score,
      tierSlug: cert.tierSlug,
      signatureHash: cert.signatureHash,
      issuedAt: cert.issuedAt ? cert.issuedAt.toISOString() : null,
      expiresAt: cert.expiresAt ? cert.expiresAt.toISOString() : null,
      verifyCount: cert.verifyCount + 1,
      message: isAuthentic
        ? 'Verified Authentic: Digitally signed by AI Interview Practice Certificate Authority.'
        : cert.status === CertificateStatus.REVOKED
          ? 'Invalid: This certificate has been revoked.'
          : cert.status === CertificateStatus.EXPIRED
            ? 'Expired: This certificate validity period has ended.'
            : 'Integrity Check Failed: Digital signature does not match certificate data.',
    };
  }

  async getUserCertificates(userId: string) {
    const certs = await this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { include: { profile: true } },
      },
    });

    return certs.map(c => ({
      ...c,
      recipientName: c.user.profile?.fullName || c.user.email.split('@')[0],
      verificationUrl: this.qrCodeService.getVerificationUrl(c.id),
    }));
  }

  async downloadCertificate(certId: string, userId?: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certId },
      include: {
        user: { include: { profile: true } },
      },
    });

    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    if (userId && cert.userId !== userId) {
      throw new ForbiddenException('Access denied to this certificate');
    }

    await this.prisma.certificate.update({
      where: { id: certId },
      data: { downloadCount: { increment: 1 } },
    });

    return {
      certId: cert.id,
      recipientName: cert.user.profile?.fullName || cert.user.email.split('@')[0],
      competencyArea: cert.competencyArea,
      score: cert.score,
      signatureHash: cert.signatureHash,
      issuedAt: cert.issuedAt,
      downloadCount: cert.downloadCount + 1,
      downloadUrl: cert.fileUrl || `/certificates/${cert.id}.pdf`,
    };
  }

  async revokeCertificate(certId: string, userId: string, reason?: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certId },
    });

    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    if (cert.userId !== userId) {
      throw new ForbiddenException('You can only revoke your own certificates');
    }

    const updated = await this.prisma.certificate.update({
      where: { id: certId },
      data: {
        status: CertificateStatus.REVOKED,
        revokedAt: new Date(),
        revokeReason: reason || 'Revoked by certificate holder',
      },
    });

    return updated;
  }
}
