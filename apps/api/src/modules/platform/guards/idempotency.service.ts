import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DomainException } from '../filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  hashPayload(payload: any): string {
    if (payload === undefined || payload === null) return '';
    const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Atomically reserves an idempotency key before request execution (H-003).
   * Returns cached response if request was already completed.
   */
  async reserveKey(
    key: string,
    userId: string,
    resource: string,
    payload?: any,
  ): Promise<{ isCached: boolean; cachedResponse?: any; responseStatus?: number }> {
    const requestHash = this.hashPayload(payload);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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

      if (existing.resource !== resource) {
        throw new DomainException(
          ErrorCode.VALIDATION_ERROR,
          'Idempotency key was previously used for a different resource',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (existing.requestHash && existing.requestHash !== requestHash) {
        throw new DomainException(
          ErrorCode.IDEMPOTENCY_CONFLICT,
          'Idempotency key reused with a conflicting request payload',
          HttpStatus.CONFLICT,
        );
      }

      if (existing.status === 'COMPLETED') {
        return {
          isCached: true,
          cachedResponse: existing.responseBody,
          responseStatus: existing.responseStatus || HttpStatus.OK,
        };
      }

      // If IN_PROGRESS, another concurrent request is executing with the exact same key
      throw new DomainException(
        ErrorCode.IDEMPOTENCY_CONFLICT,
        'A request with this Idempotency-Key is currently in progress. Please wait for completion.',
        HttpStatus.CONFLICT,
      );
    }

    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          key,
          userId,
          resource,
          requestHash,
          status: 'IN_PROGRESS',
          expiresAt,
        },
      });
    } catch (err: any) {
      // Race condition: another request created the record concurrently
      const concurrent = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
      if (concurrent?.status === 'COMPLETED') {
        return {
          isCached: true,
          cachedResponse: concurrent.responseBody,
          responseStatus: concurrent.responseStatus || HttpStatus.OK,
        };
      }
      throw new DomainException(
        ErrorCode.IDEMPOTENCY_CONFLICT,
        'Concurrent request with this Idempotency-Key detected.',
        HttpStatus.CONFLICT,
      );
    }

    return { isCached: false };
  }

  async completeKey(key: string, responseStatus: number, responseBody: any) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return this.prisma.idempotencyRecord
      .update({
        where: { key },
        data: {
          status: 'COMPLETED',
          responseStatus,
          responseBody,
          expiresAt,
        },
      })
      .catch(err => {
        this.logger.warn(`Could not mark idempotency key ${key} completed: ${err.message}`);
      });
  }

  async releaseKey(key: string) {
    return this.prisma.idempotencyRecord
      .deleteMany({
        where: { key, status: 'IN_PROGRESS' },
      })
      .catch(() => null);
  }

  // Backwards compatibility wrappers
  async checkKey(key: string, userId: string, resource: string) {
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
      return existing.status === 'COMPLETED' ? existing : null;
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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return this.prisma.idempotencyRecord.upsert({
      where: { key },
      update: {
        status: 'COMPLETED',
        responseStatus,
        responseBody,
        expiresAt,
      },
      create: {
        key,
        userId,
        resource,
        status: 'COMPLETED',
        responseStatus,
        responseBody,
        expiresAt,
      },
    });
  }
}
