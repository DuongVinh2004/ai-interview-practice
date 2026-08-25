import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { MfaStepUpGuard } from '../guards/mfa-step-up.guard';
import { ErrorCode, UserRole } from '@ai-interview/contracts';
import { DomainException } from '../../../platform/filters/all-exceptions.filter';

describe('MfaStepUpGuard (F-001, F-002 Negative Matrix)', () => {
  let guard: MfaStepUpGuard;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };
    guard = new MfaStepUpGuard(mockPrisma as any);
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

  it('MUST throw UNAUTHORIZED when no user is attached to request', async () => {
    const context = createMockContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(DomainException);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      errorCode: ErrorCode.UNAUTHORIZED,
    });
  });

  it('MUST reject Admin who has not enabled MFA (F-002 enforcement)', async () => {
    const context = createMockContext({ sub: 'admin-1', role: UserRole.ADMIN, mfaVerified: false });
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: false });

    await expect(guard.canActivate(context)).rejects.toThrow(DomainException);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      errorCode: ErrorCode.MFA_STEP_UP_REQUIRED,
    });
  });

  it('MUST reject user with MFA enabled when session is not verified (mfaVerified === false)', async () => {
    const context = createMockContext({ sub: 'user-1', role: UserRole.CANDIDATE, mfaVerified: false });
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: true });

    await expect(guard.canActivate(context)).rejects.toThrow(DomainException);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      errorCode: ErrorCode.MFA_STEP_UP_REQUIRED,
    });
  });

  it('MUST allow verified user (mfaEnabled === true && mfaVerified === true)', async () => {
    const context = createMockContext({ sub: 'admin-1', role: UserRole.ADMIN, mfaVerified: true });
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: true });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('MUST allow Candidate without MFA if step-up is not configured for non-sensitive role', async () => {
    const context = createMockContext({ sub: 'candidate-1', role: UserRole.CANDIDATE, mfaVerified: false });
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: false });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
