import { Injectable } from '@nestjs/common';
import { MediaProvider } from './media-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class MockMediaProvider implements MediaProvider {
  private readonly signingKey = crypto.randomBytes(32);

  async createRoom(sessionId: string): Promise<{ roomName: string }> {
    return {
      roomName: `room-${sessionId.slice(0, 8)}`,
    };
  }

  async generateToken(
    sessionId: string,
    userId: string,
    role: 'MENTOR' | 'CANDIDATE',
    participantName: string,
  ): Promise<string> {
    const payload = JSON.stringify({
      sessionId,
      userId,
      role,
      name: participantName,
      exp: Math.floor(Date.now() / 1000) + 7200, // 2 hours validity
    });
    const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
    const encodedHeader = Buffer.from(header).toString('base64url');
    const encodedPayload = Buffer.from(payload).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.signingKey)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }
}
