import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { BillingMetric, ErrorCode } from '@ai-interview/contracts';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';

export const EntitlementMetric = {
  AUDIO_MINUTES: 'audio.minutes',
  VISION_TOKENS: 'vision.tokens',
  QUESTION_BANK_ANSWER_REVEALS: 'question_bank.answer_reveals',
} as const;

export type EntitlementMetricValue = (typeof EntitlementMetric)[keyof typeof EntitlementMetric];

export interface ReserveEntitlementInput {
  userId: string;
  metric: EntitlementMetricValue;
  quantity: number;
  idempotencyKey: string;
  operationType: string;
  operationId?: string;
  requestFingerprint?: string;
  expiresInMs?: number;
}

export interface CommitEntitlementInput {
  reservationId: string;
  actualQuantity: number;
  provider?: string;
  providerOperationId?: string;
  billingMetric?: BillingMetric;
}

export interface ResolveEntitlementReconciliationInput {
  reservationId: string;
  outcome: 'NO_PROVIDER_USAGE' | 'CONFIRMED_PROVIDER_USAGE';
  actualQuantity?: number;
  provider?: string;
  providerOperationId?: string;
  evidence?: Record<string, unknown>;
}

interface EntitlementPolicy {
  limit: number | null;
  accessPeriodKey: string;
  resetsAt: Date;
}

class RetryableReservationConflict extends Error {
  readonly code = 'ENTITLEMENT_RETRY';
}

/**
 * The only write boundary for paid-capability quotas. A reservation is durable
 * before a provider call, then becomes committed, released, or held for
 * reconciliation. Callers must supply a stable operation-specific idempotency key.
 */
@Injectable()
export class EntitlementReservationService {
  private static readonly DEFAULT_EXPIRY_MS = 15 * 60 * 1000;
  private static readonly MAX_RETRIES = 3;

  constructor(private readonly prisma: PrismaService) {}

  async reserve(input: ReserveEntitlementInput): Promise<any> {
    this.validateReserveInput(input);
    let lastError: unknown;

    for (let attempt = 1; attempt <= EntitlementReservationService.MAX_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(async tx => this.reserveInTransaction(tx, input), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10_000,
        });
      } catch (error: any) {
        lastError = error;
        if (!this.isRetryable(error) || attempt === EntitlementReservationService.MAX_RETRIES) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  async reserveInTransaction(tx: any, input: ReserveEntitlementInput): Promise<any> {
    this.validateReserveInput(input);
    const policy = await this.getPolicyInTransaction(tx, input.userId, input.metric);
    const fingerprint = this.fingerprint(input);
    const existing = await tx.entitlementReservation.findUnique({
      where: {
        userId_metric_accessPeriodKey_idempotencyKey: {
          userId: input.userId,
          metric: input.metric,
          accessPeriodKey: policy.accessPeriodKey,
          idempotencyKey: input.idempotencyKey.trim(),
        },
      },
    });

    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new ConflictException(
          'Idempotency key was already used for a different entitlement operation',
        );
      }
      if (existing.state === 'RESERVED' && existing.expiresAt <= new Date()) {
        throw new ConflictException(
          'The earlier entitlement operation expired and is awaiting reconciliation',
        );
      }
      return { ...existing, isNewReservation: false };
    }

    const bucket = await tx.entitlementBucket.upsert({
      where: {
        userId_metric_accessPeriodKey: {
          userId: input.userId,
          metric: input.metric,
          accessPeriodKey: policy.accessPeriodKey,
        },
      },
      update: { limit: policy.limit, resetsAt: policy.resetsAt },
      create: {
        userId: input.userId,
        metric: input.metric,
        accessPeriodKey: policy.accessPeriodKey,
        limit: policy.limit,
        resetsAt: policy.resetsAt,
      },
    });

    if (
      bucket.limit !== null &&
      bucket.limit !== undefined &&
      bucket.consumed + bucket.reserved + input.quantity > bucket.limit
    ) {
      throw new DomainException(
        ErrorCode.QUOTA_EXCEEDED,
        `Quota exhausted for ${input.metric}`,
        403,
      );
    }

    const claimed = await tx.entitlementBucket.updateMany({
      where: { id: bucket.id, version: bucket.version },
      data: {
        reserved: { increment: input.quantity },
        version: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      throw new RetryableReservationConflict('Entitlement bucket changed concurrently');
    }

    const created = await tx.entitlementReservation.create({
      data: {
        bucketId: bucket.id,
        userId: input.userId,
        metric: input.metric,
        accessPeriodKey: policy.accessPeriodKey,
        idempotencyKey: input.idempotencyKey.trim(),
        requestFingerprint: fingerprint,
        operationType: input.operationType,
        operationId: input.operationId,
        estimatedQuantity: input.quantity,
        expiresAt: new Date(
          Date.now() + (input.expiresInMs || EntitlementReservationService.DEFAULT_EXPIRY_MS),
        ),
      },
    });
    return { ...created, isNewReservation: true };
  }

  async commit(input: CommitEntitlementInput): Promise<any> {
    this.validateCommitInput(input);
    let lastError: unknown;

    for (let attempt = 1; attempt <= EntitlementReservationService.MAX_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(async tx => this.commitInTransaction(tx, input), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10_000,
        });
      } catch (error: any) {
        lastError = error;
        if (!this.isRetryable(error) || attempt === EntitlementReservationService.MAX_RETRIES) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  async commitInTransaction(tx: any, input: CommitEntitlementInput): Promise<any> {
    this.validateCommitInput(input);
    const reservation = await tx.entitlementReservation.findUnique({
      where: { id: input.reservationId },
    });
    if (!reservation) {
      throw new ConflictException('Entitlement reservation not found');
    }
    if (reservation.state === 'COMMITTED') {
      return reservation;
    }
    if (reservation.state !== 'RESERVED') {
      throw new ConflictException(
        `Cannot commit entitlement reservation in ${reservation.state} state`,
      );
    }
    if (input.actualQuantity > reservation.estimatedQuantity) {
      await tx.entitlementReservation.update({
        where: { id: reservation.id },
        data: {
          state: 'RECONCILIATION_REQUIRED',
          actualQuantity: input.actualQuantity,
          reconciliationData: {
            reason: 'actual_usage_exceeds_conservative_reservation',
            estimatedQuantity: reservation.estimatedQuantity,
            actualQuantity: input.actualQuantity,
          },
        },
      });
      throw new ConflictException(
        'Actual provider usage exceeds its reservation and requires reconciliation',
      );
    }

    const bucket = await tx.entitlementBucket.findUnique({ where: { id: reservation.bucketId } });
    if (!bucket || bucket.reserved < reservation.estimatedQuantity) {
      throw new RetryableReservationConflict(
        'Entitlement reservation does not have a matching bucket balance',
      );
    }
    const updated = await tx.entitlementBucket.updateMany({
      where: { id: bucket.id, version: bucket.version },
      data: {
        reserved: { decrement: reservation.estimatedQuantity },
        consumed: { increment: input.actualQuantity },
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new RetryableReservationConflict('Entitlement bucket changed concurrently');
    }

    if (input.billingMetric) {
      await tx.usageRecord.create({
        data: {
          userId: reservation.userId,
          metric: input.billingMetric,
          quantity: input.actualQuantity,
          reservationId: reservation.id,
        },
      });
    }

    return tx.entitlementReservation.update({
      where: { id: reservation.id },
      data: {
        state: 'COMMITTED',
        actualQuantity: input.actualQuantity,
        provider: input.provider,
        providerOperationId: input.providerOperationId,
      },
    });
  }

  async release(reservationId: string, reason: string): Promise<any> {
    if (!reason?.trim()) {
      throw new ConflictException('A release reason is required');
    }
    let lastError: unknown;
    for (let attempt = 1; attempt <= EntitlementReservationService.MAX_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async tx => {
            const reservation = await tx.entitlementReservation.findUnique({
              where: { id: reservationId },
            });
            if (!reservation) {
              throw new ConflictException('Entitlement reservation not found');
            }
            if (reservation.state === 'RELEASED') {
              return reservation;
            }
            if (reservation.state !== 'RESERVED') {
              throw new ConflictException(
                `Cannot release entitlement reservation in ${reservation.state} state`,
              );
            }

            const bucket = await tx.entitlementBucket.findUnique({
              where: { id: reservation.bucketId },
            });
            if (!bucket || bucket.reserved < reservation.estimatedQuantity) {
              throw new RetryableReservationConflict(
                'Entitlement reservation does not have a matching bucket balance',
              );
            }
            const updated = await tx.entitlementBucket.updateMany({
              where: { id: bucket.id, version: bucket.version },
              data: {
                reserved: { decrement: reservation.estimatedQuantity },
                version: { increment: 1 },
              },
            });
            if (updated.count !== 1) {
              throw new RetryableReservationConflict('Entitlement bucket changed concurrently');
            }

            return tx.entitlementReservation.update({
              where: { id: reservation.id },
              data: { state: 'RELEASED', resolutionReason: reason.trim() },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
        );
      } catch (error: any) {
        lastError = error;
        if (!this.isRetryable(error) || attempt === EntitlementReservationService.MAX_RETRIES) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Completes an operator-verified reconciliation without ever refunding an
   * ambiguous provider call automatically. This method is intentionally an
   * internal service boundary; callers must retain provider evidence.
   */
  async resolveReconciliation(input: ResolveEntitlementReconciliationInput): Promise<any> {
    this.validateReconciliationInput(input);
    let lastError: unknown;

    for (let attempt = 1; attempt <= EntitlementReservationService.MAX_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async tx => {
            const reservation = await tx.entitlementReservation.findUnique({
              where: { id: input.reservationId },
            });
            if (!reservation) {
              throw new ConflictException('Entitlement reservation not found');
            }
            if (reservation.state === 'COMMITTED' || reservation.state === 'RELEASED') {
              return reservation;
            }
            if (reservation.state !== 'RECONCILIATION_REQUIRED') {
              throw new ConflictException(
                `Cannot reconcile entitlement reservation in ${reservation.state} state`,
              );
            }

            const bucket = await tx.entitlementBucket.findUnique({
              where: { id: reservation.bucketId },
            });
            if (!bucket || bucket.reserved < reservation.estimatedQuantity) {
              throw new RetryableReservationConflict(
                'Entitlement reservation does not have a matching bucket balance',
              );
            }

            const evidence = {
              outcome: input.outcome,
              evidence: input.evidence || {},
              resolvedBy: 'operator',
            } as Prisma.InputJsonValue;

            if (input.outcome === 'NO_PROVIDER_USAGE') {
              const released = await tx.entitlementBucket.updateMany({
                where: { id: bucket.id, version: bucket.version },
                data: {
                  reserved: { decrement: reservation.estimatedQuantity },
                  version: { increment: 1 },
                },
              });
              if (released.count !== 1) {
                throw new RetryableReservationConflict('Entitlement bucket changed concurrently');
              }
              return tx.entitlementReservation.update({
                where: { id: reservation.id },
                data: {
                  state: 'RELEASED',
                  resolutionReason: 'provider_usage_confirmed_absent',
                  reconciliationData: evidence,
                  reconciledAt: new Date(),
                },
              });
            }

            const actualQuantity = input.actualQuantity!;
            const remainingReserved = bucket.reserved - reservation.estimatedQuantity;
            if (
              bucket.limit !== null &&
              bucket.limit !== undefined &&
              bucket.consumed + remainingReserved + actualQuantity > bucket.limit
            ) {
              throw new DomainException(
                ErrorCode.QUOTA_EXCEEDED,
                'Confirmed provider usage exceeds the remaining entitlement balance',
                403,
              );
            }
            const committed = await tx.entitlementBucket.updateMany({
              where: { id: bucket.id, version: bucket.version },
              data: {
                reserved: { decrement: reservation.estimatedQuantity },
                consumed: { increment: actualQuantity },
                version: { increment: 1 },
              },
            });
            if (committed.count !== 1) {
              throw new RetryableReservationConflict('Entitlement bucket changed concurrently');
            }

            const billingMetric = this.billingMetricFor(reservation.metric);
            if (billingMetric) {
              await tx.usageRecord.create({
                data: {
                  userId: reservation.userId,
                  metric: billingMetric,
                  quantity: actualQuantity,
                  reservationId: reservation.id,
                },
              });
            }
            return tx.entitlementReservation.update({
              where: { id: reservation.id },
              data: {
                state: 'COMMITTED',
                actualQuantity,
                provider: input.provider || reservation.provider,
                providerOperationId: input.providerOperationId || reservation.providerOperationId,
                resolutionReason: 'provider_usage_confirmed',
                reconciliationData: evidence,
                reconciledAt: new Date(),
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
        );
      } catch (error: any) {
        lastError = error;
        if (!this.isRetryable(error) || attempt === EntitlementReservationService.MAX_RETRIES) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  async markForReconciliation(
    reservationId: string,
    reason: string,
    details?: Record<string, unknown>,
  ) {
    return this.prisma.entitlementReservation.updateMany({
      where: { id: reservationId, state: 'RESERVED' },
      data: {
        state: 'RECONCILIATION_REQUIRED',
        resolutionReason: reason.slice(0, 500),
        reconciliationData: (details as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async markProviderDispatchStarted(reservationId: string, provider: string): Promise<void> {
    const updated = await this.prisma.entitlementReservation.updateMany({
      where: { id: reservationId, state: 'RESERVED', providerDispatchStartedAt: null },
      data: { providerDispatchStartedAt: new Date(), provider: provider.slice(0, 100) },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Entitlement reservation is not available for provider dispatch');
    }
  }

  async getPolicyInTransaction(
    tx: any,
    userId: string,
    metric: EntitlementMetricValue,
  ): Promise<EntitlementPolicy> {
    const now = new Date();
    const subscription = await tx.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodStart: { lte: now },
        currentPeriodEnd: { gt: now },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    const configuredPlanSlug = String(subscription?.plan?.slug || '').toLowerCase();
    const planSlug = configuredPlanSlug || 'free';
    // Only an explicitly identified free tier is a free entitlement. Treating a
    // legacy subscription without its joined plan as free would silently lower
    // its entitlement and break the existing subscription-period contract.
    const isPaidSubscription = Boolean(
      subscription?.id && subscription.status === 'ACTIVE' && configuredPlanSlug !== 'free',
    );
    const periodStart = isPaidSubscription
      ? new Date(subscription.currentPeriodStart)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const resetsAt = isPaidSubscription
      ? new Date(subscription.currentPeriodEnd)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const accessPeriodKey = isPaidSubscription
      ? `sub_${subscription.id}_${periodStart.toISOString().slice(0, 10)}`
      : `month_${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const limits = (subscription?.plan?.limits || {}) as Record<string, unknown>;

    switch (metric) {
      case EntitlementMetric.AUDIO_MINUTES:
        return {
          limit: this.positiveIntegerLimit(
            limits.voiceMinutesPerMonth,
            isPaidSubscription ? 60 : 15,
          ),
          accessPeriodKey,
          resetsAt,
        };
      case EntitlementMetric.VISION_TOKENS:
        return {
          limit: this.positiveIntegerLimit(
            limits.aiTokensPerMonth,
            isPaidSubscription ? 200_000 : 50_000,
          ),
          accessPeriodKey,
          resetsAt,
        };
      case EntitlementMetric.QUESTION_BANK_ANSWER_REVEALS:
        return {
          limit:
            planSlug === 'team' || planSlug === 'enterprise' ? null : planSlug === 'pro' ? 50 : 5,
          accessPeriodKey,
          resetsAt,
        };
    }

    throw new ConflictException(`Unsupported entitlement metric: ${metric}`);
  }

  private validateReserveInput(input: ReserveEntitlementInput) {
    if (!input.userId || !input.metric || !input.operationType) {
      throw new ConflictException(
        'Entitlement reservation requires user, metric, and operation type',
      );
    }
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
      throw new ConflictException('Entitlement reservation quantity must be a positive integer');
    }
    if (!input.idempotencyKey || input.idempotencyKey.trim().length > 255) {
      throw new ConflictException('A valid entitlement idempotency key is required');
    }
  }

  private validateCommitInput(input: CommitEntitlementInput) {
    if (
      !input.reservationId ||
      !Number.isSafeInteger(input.actualQuantity) ||
      input.actualQuantity <= 0
    ) {
      throw new ConflictException(
        'Entitlement commit requires a reservation and positive actual quantity',
      );
    }
  }

  private validateReconciliationInput(input: ResolveEntitlementReconciliationInput) {
    if (!input.reservationId) {
      throw new ConflictException('Entitlement reconciliation requires a reservation');
    }
    if (
      input.outcome !== 'NO_PROVIDER_USAGE' &&
      input.outcome !== 'CONFIRMED_PROVIDER_USAGE'
    ) {
      throw new ConflictException('A valid reconciliation outcome is required');
    }
    if (
      input.outcome === 'CONFIRMED_PROVIDER_USAGE' &&
      (!Number.isSafeInteger(input.actualQuantity) || input.actualQuantity! <= 0)
    ) {
      throw new ConflictException(
        'Confirmed provider usage requires a positive whole-number quantity',
      );
    }
  }

  private billingMetricFor(metric: string): BillingMetric | undefined {
    if (metric === EntitlementMetric.AUDIO_MINUTES) return BillingMetric.AUDIO_MINUTE;
    if (metric === EntitlementMetric.VISION_TOKENS) return BillingMetric.AI_TOKEN;
    return undefined;
  }

  private fingerprint(input: ReserveEntitlementInput): string {
    return (
      input.requestFingerprint ||
      createHash('sha256')
        .update(
          JSON.stringify({
            metric: input.metric,
            quantity: input.quantity,
            operationType: input.operationType,
            operationId: input.operationId || null,
          }),
        )
        .digest('hex')
    );
  }

  private positiveIntegerLimit(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private isRetryable(error: any): boolean {
    return (
      error?.code === 'P2034' || error?.code === 'P2002' || error?.code === 'ENTITLEMENT_RETRY'
    );
  }
}
