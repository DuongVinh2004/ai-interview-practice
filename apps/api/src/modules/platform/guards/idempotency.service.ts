import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainException } from '../filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async checkKey(key: string, userId: string, _resource: string) {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key },
    });

    if (existing) {
      if (existing.userId !== userId) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'Idempotency key belongs to another user',
          HttpStatus.FORBIDDEN,
        );
      }
      return existing;
    }

    return null;
  }

  async saveKey(
    key: string,
    userId: string,
    resource: string,
    responseStatus: number,
    responseBody: any,
  ) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    return this.prisma.idempotencyRecord.upsert({
      where: { key },
      update: {
        responseStatus,
        responseBody,
        expiresAt,
      },
      create: {
        key,
        userId,
        resource,
        responseStatus,
        responseBody,
        expiresAt,
      },
    });
  }
}
