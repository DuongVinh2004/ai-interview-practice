import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class SignatureService {
  private readonly secret: string;

  constructor() {
    this.secret = process.env.CERTIFICATE_SECRET || 'ai-interview-practice-secret-cert-key-2026';
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
