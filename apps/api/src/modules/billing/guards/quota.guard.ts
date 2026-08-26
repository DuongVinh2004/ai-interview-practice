import { Injectable, CanActivate, ExecutionContext, HttpStatus, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsageMeterService } from '../usage-meter.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { BillingMetric, ErrorCode } from '@ai-interview/contracts';

export const REQUIRE_QUOTA_KEY = 'require_quota';
export const RequireQuota = (metric: BillingMetric) => SetMetadata(REQUIRE_QUOTA_KEY, metric);

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usageMeter: UsageMeterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredMetric = this.reflector.getAllAndOverride<BillingMetric>(REQUIRE_QUOTA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredMetric) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub || request.user?.id;

    if (!userId) {
      return true;
    }

    const quota = await this.usageMeter.checkQuota(userId, requiredMetric);
    if (!quota.allowed) {
      throw new DomainException(
        ErrorCode.QUOTA_EXCEEDED,
        `Monthly quota limit reached for ${requiredMetric} (${quota.currentUsage}/${quota.limit}). Please upgrade your plan.`,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
