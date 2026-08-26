import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../../storage/storage.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DataRetentionCron {
  private readonly logger = new Logger(DataRetentionCron.name);
  private readonly instanceId = uuidv4();
  private localExecutionLocks = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storageService?: StorageService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  /**
   * Run daily at midnight with distributed singleton lock (PRIV-002)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyDataPurge() {
    const todayStr = new Date().toISOString().split('T')[0];
    const lockKey = `cron:lock:data-retention:${todayStr}`;
    const LOCK_TTL_SECONDS = 7200; // 2 hour distributed lock

    const acquired = await this.acquireDistributedLock(lockKey, LOCK_TTL_SECONDS);
    if (!acquired) {
      this.logger.log(
        `[PRIV-002] Daily data retention purge lock for ${todayStr} is held by another replica. Skipping execution.`,
      );
      return;
    }

    this.logger.log(
      `[PRIV-002] Acquired distributed lock for data retention purge on ${todayStr}. Executing purge...`,
    );

    const now = new Date();

    try {
      // 1. Find expired documents and delete associated cloud storage objects (PRIV-002)
      const expiredDocs = await this.prisma.userDocument.findMany({
        where: { expiresAt: { lt: now } },
        include: { fileAsset: true },
      });

      if (this.storageService) {
        for (const doc of expiredDocs) {
          if (doc.fileAsset) {
            try {
              await this.storageService.deleteFile(doc.userId, doc.fileAsset.key, 'ADMIN');
            } catch (storageErr: any) {
              this.logger.warn(
                `Failed to delete storage asset ${doc.fileAsset.key} for expired doc ${doc.id}: ${storageErr.message}`,
              );
            }
          }
        }
      }

      // 2. Physically delete expired UserDocuments (CVs, JDs, blueprints older than retention window)
      const deletedDocs = await this.prisma.userDocument.deleteMany({
        where: {
          id: { in: expiredDocs.map(d => d.id) },
        },
      });

      this.logger.log(
        `[PRIV-002] Successfully purged ${deletedDocs.count} expired user documents and associated cloud assets.`,
      );

      // 3. Audit log of retention purge
      await this.prisma.auditLog.create({
        data: {
          action: 'DATA_RETENTION_PURGE' as any,
          resource: 'system_retention',
          resourceId: `purge-${todayStr}`,
          details: {
            purgedExpiredDocumentsCount: deletedDocs.count,
            purgedAt: now.toISOString(),
          },
        },
      });
    } catch (err: any) {
      this.logger.error(
        `[PRIV-002] Error during daily data retention purge: ${err.message}`,
        err.stack,
      );
    }
  }

  private async acquireDistributedLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    if (this.redisService) {
      try {
        const client = this.redisService.getClient();
        if (client) {
          const result = await client.set(lockKey, this.instanceId, 'EX', ttlSeconds, 'NX');
          return result === 'OK';
        }
      } catch (err: any) {
        this.logger.warn(
          `Redis lock attempt failed, falling back to process-local locking: ${err.message}`,
        );
      }
    }

    if (this.localExecutionLocks.has(lockKey)) {
      return false;
    }
    this.localExecutionLocks.add(lockKey);
    return true;
  }

  /**
   * Manual trigger for testing and admin operations
   */
  async triggerManualPurge(): Promise<{ purgedDocsCount: number }> {
    const now = new Date();
    const expiredDocs = await this.prisma.userDocument.findMany({
      where: { expiresAt: { lt: now } },
      include: { fileAsset: true },
    });

    if (this.storageService) {
      for (const doc of expiredDocs) {
        if (doc.fileAsset) {
          try {
            await this.storageService.deleteFile(doc.userId, doc.fileAsset.key, 'ADMIN');
          } catch (storageErr: any) {
            this.logger.warn(
              `Failed to delete storage asset ${doc.fileAsset.key} for expired doc ${doc.id}: ${storageErr.message}`,
            );
          }
        }
      }
    }

    const deletedDocs = await this.prisma.userDocument.deleteMany({
      where: {
        id: { in: expiredDocs.map(d => d.id) },
      },
    });

    return { purgedDocsCount: deletedDocs.count };
  }
}
