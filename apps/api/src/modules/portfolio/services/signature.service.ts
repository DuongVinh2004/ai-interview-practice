import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class SignatureService {
  private readonly secret: string;

  constructor(@Optional() configService?: ConfigService) {
    const configuredSecret =
      configService?.get<string>('CERTIFICATE_SECRET') || process.env.CERTIFICATE_SECRET;
    if (!configuredSecret && process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: CERTIFICATE_SECRET must be configured in production');
    }
    this.secret = configuredSecret || 'development-only-certificate-secret-not-for-production';
  }

  generateSignature(
    certId: string,
    userId: string,
    competency: string,
    score: number,
    issuedAt: string | Date,
  ): string {
    const issuedIso =
      issuedAt instanceof Date ? issuedAt.toISOString() : new Date(issuedAt).toISOString();
    const payload = `${certId}:${userId}:${competency}:${score.toFixed(1)}:${issuedIso}`;
    return crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  verifySignature(
    certId: string,
    userId: string,
    competency: string,
    score: number,
    issuedAt: string | Date,
    signatureHash: string,
  ): boolean {
    const expected = this.generateSignature(certId, userId, competency, score, issuedAt);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signatureHash, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
