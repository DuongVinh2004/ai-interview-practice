import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { MfaStepUpGuard } from '../guards/mfa-step-up.guard';
import { RolesGuard } from '../guards/roles.guard';
import { ErrorCode, UserRole } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

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

  const createMockContext = (user?: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  it('MUST throw UNAUTHORIZED when no user is attached to request', async () => {
    const context = createMockContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(DomainException);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED,
    });
  });

  it('MUST reject Admin who has not enabled MFA (F-002 enforcement)', async () => {
    const context = createMockContext({ sub: 'admin-1', role: UserRole.ADMIN, mfaVerified: false });
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: false });

    await expect(guard.canActivate(context)).rejects.toThrow(DomainException);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.MFA_STEP_UP_REQUIRED,
    });
  });

  it('MUST reject user with MFA enabled when session is not verified (mfaVerified === false)', async () => {
    const context = createMockContext({
      sub: 'user-1',
      role: UserRole.CANDIDATE,
      mfaVerified: false,
    });
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: true });

    await expect(guard.canActivate(context)).rejects.toThrow(DomainException);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.MFA_STEP_UP_REQUIRED,
    });
  });

  it('MUST allow verified user (mfaEnabled === true && mfaVerified === true)', async () => {
    const context = createMockContext({ sub: 'admin-1', role: UserRole.ADMIN, mfaVerified: true });
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: true });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('MUST allow Candidate without MFA if step-up is not configured for non-sensitive role', async () => {
    const context = createMockContext({
      sub: 'candidate-1',
      role: UserRole.CANDIDATE,
      mfaVerified: false,
    });
    mockPrisma.user.findUnique.mockResolvedValue({ mfaEnabled: false });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});

describe('RolesGuard (Admin MFA Enforcement - AG-PACKET-003 / SEC-003)', () => {
  let rolesGuard: any;
  let mockReflector: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    };
    rolesGuard = new RolesGuard(mockReflector);
  });

  const createMockContext = (user?: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  it('MUST reject single-factor Admin on admin routes (mfaVerified === false) (fails closed)', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({
      sub: 'admin-1',
      role: UserRole.ADMIN,
      mfaVerified: false,
    });

    expect(() => rolesGuard.canActivate(context)).toThrow(DomainException);
    try {
      rolesGuard.canActivate(context);
    } catch (err: any) {
      expect(err.status).toBe(HttpStatus.FORBIDDEN);
      expect(err.code).toBe(ErrorCode.MFA_STEP_UP_REQUIRED);
    }
  });

  it('MUST allow Admin with verified MFA on admin routes (mfaVerified === true)', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({
      sub: 'admin-1',
      role: UserRole.ADMIN,
      mfaVerified: true,
    });

    const result = rolesGuard.canActivate(context);
    expect(result).toBe(true);
  });

  it('MUST allow Candidate on candidate routes regardless of MFA (non-admin unaffected)', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.CANDIDATE]);
    const context = createMockContext({
      sub: 'candidate-1',
      role: UserRole.CANDIDATE,
      mfaVerified: false,
    });

    const result = rolesGuard.canActivate(context);
    expect(result).toBe(true);
  });

  it('MUST reject user with insufficient role on admin routes', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({
      sub: 'candidate-1',
      role: UserRole.CANDIDATE,
      mfaVerified: false,
    });

    expect(() => rolesGuard.canActivate(context)).toThrow();
  });
});
