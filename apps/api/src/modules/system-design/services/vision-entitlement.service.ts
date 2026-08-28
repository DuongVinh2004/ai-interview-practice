import { ConflictException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { BillingMetric, ErrorCode } from '@ai-interview/contracts';
import {
  EntitlementMetric,
  EntitlementReservationService,
} from '../../billing/entitlement-reservation.service';
import {
  VisionEvaluationOptions,
  VisionEvaluationResult,
  VisionProvider,
} from '../interfaces/vision-provider.interface';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

/**
 * The single paid-call boundary for all system-design vision providers.
 * A durable reservation is created before a non-mock provider can receive a
 * request; ambiguous provider outcomes are deliberately not retried.
 */
@Injectable()
export class VisionEntitlementService {
  constructor(private readonly reservations: EntitlementReservationService) {}

  async evaluate(input: {
    userId: string;
    idempotencyKey?: string;
    operationType:
      'system-design.analyze' | 'system-design.evaluate' | 'system-design.evaluate-diagram';
    interviewId: string;
    provider: VisionProvider;
    options: VisionEvaluationOptions;
  }): Promise<VisionEvaluationResult> {
    const key = this.requireIdempotencyKey(input.idempotencyKey);
    if (input.provider.name.toLowerCase().includes('mock')) {
      return input.provider.evaluateDiagram(input.options);
    }

    const estimatedQuantity = this.estimateTokens(input.options);
    const reservation = await this.reservations.reserve({
      userId: input.userId,
      metric: EntitlementMetric.VISION_TOKENS,
      quantity: estimatedQuantity,
      idempotencyKey: key,
      operationType: input.operationType,
      operationId: `${input.interviewId}:${this.requestDigest(input.options)}`,
    });

    if (reservation.state === 'RECONCILIATION_REQUIRED') {
      throw new ConflictException('The earlier vision request is awaiting reconciliation.');
    }
    if (reservation.state !== 'RESERVED' || reservation.isNewReservation !== true) {
      throw new ConflictException(
        'This vision request has already been processed; use a new idempotency key.',
      );
    }

    try {
      await this.reservations.markProviderDispatchStarted(reservation.id, input.provider.name);
      const result = await input.provider.evaluateDiagram(input.options);
      await this.reservations.commit({
        reservationId: reservation.id,
        actualQuantity: this.actualTokens(result, estimatedQuantity),
        provider: input.provider.name,
        billingMetric: BillingMetric.AI_TOKEN,
      });
      return result;
    } catch (error: any) {
      await this.resolveProviderFailure(reservation.id, error);
      throw error;
    }
  }

  private requireIdempotencyKey(idempotencyKey?: string): string {
    const cleanKey = idempotencyKey?.trim();
    if (!cleanKey || cleanKey.length > 255) {
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        'Idempotency-Key header is required for vision operations.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return cleanKey;
  }

  private estimateTokens(options: VisionEvaluationOptions): number {
    const imageBytes = Math.ceil((options.imageBase64?.length || 0) * 0.75);
    const canvasBytes = Buffer.byteLength(JSON.stringify(options.canvasData || {}));
    // The constant covers the fixed high-detail prompt and model output; the
    // payload terms make a large untrusted canvas consume more quota up front.
    return Math.min(
      50_000,
      Math.max(2_000, 2_000 + Math.ceil(imageBytes / 400) + Math.ceil(canvasBytes / 4)),
    );
  }

  private actualTokens(result: VisionEvaluationResult, estimate: number): number {
    return Number.isSafeInteger(result.usageTokens) && result.usageTokens! > 0
      ? result.usageTokens!
      : estimate;
  }

  private requestDigest(options: VisionEvaluationOptions): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          image: options.imageBase64 || '',
          canvas: options.canvasData || null,
          title: options.problemTitle || null,
          language: options.language || null,
        }),
      )
      .digest('hex');
  }

  private async resolveProviderFailure(reservationId: string, error: any): Promise<void> {
    try {
      if (error?.status === HttpStatus.BAD_REQUEST) {
        await this.reservations.release(reservationId, 'provider_rejected_preflight_input');
        return;
      }
      await this.reservations.markForReconciliation(
        reservationId,
        'paid_vision_provider_outcome_ambiguous',
        {
          status: error?.status,
          code: error?.code,
          message: String(error?.message || '').slice(0, 500),
        },
      );
    } catch {
      // Keep the original provider error. The reservation remains fail-closed
      // if this defensive bookkeeping attempt cannot be completed.
    }
  }
}
