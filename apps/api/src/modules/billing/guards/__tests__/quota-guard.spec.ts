import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QuotaGuard, REQUIRE_QUOTA_KEY } from '../quota.guard';
import { BillingMetric, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../../platform/filters/all-exceptions.filter';

describe('QuotaGuard (F-007 Enforcement)', () => {
  let guard: QuotaGuard;
  let reflector: Reflector;
  let mockUsageMeter: any;

  beforeEach(() => {
    reflector = new Reflector();
    mockUsageMeter = {
      checkQuota: jest.fn(),
    };
    guard = new QuotaGuard(reflector, mockUsageMeter);
  });

  const createMockContext = (user?: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any);

  it('MUST pass if no quota metric is required on handler/class', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ sub: 'user-1' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockUsageMeter.checkQuota).not.toHaveBeenCalled();
  });

  it('MUST throw QUOTA_EXCEEDED (403) when user exceeds limit', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(BillingMetric.SESSION_COUNT);
    mockUsageMeter.checkQuota.mockResolvedValue({ allowed: false, currentUsage: 5, limit: 5 });
    const context = createMockContext({ sub: 'user-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(DomainException);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.QUOTA_EXCEEDED,
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('MUST allow request when user is within quota limits', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(BillingMetric.SESSION_COUNT);
    mockUsageMeter.checkQuota.mockResolvedValue({ allowed: true, currentUsage: 2, limit: 5 });
    const context = createMockContext({ sub: 'user-1' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
