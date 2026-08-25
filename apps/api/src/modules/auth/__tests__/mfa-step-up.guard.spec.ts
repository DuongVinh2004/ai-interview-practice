import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { MfaStepUpGuard } from '../guards/mfa-step-up.guard';
import { UserRole, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

describe('MfaStepUpGuard (P1-001)', () => {
  let guard: MfaStepUpGuard;

  beforeEach(() => {
    guard = new MfaStepUpGuard();
  });

  const createMockContext = (user: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: (() => ({ user })) as any,
      getResponse: jest.fn() as any,
      getNext: jest.fn() as any,
    }),
    getClass: jest.fn() as any,
    getHandler: jest.fn() as any,
    getArgs: jest.fn() as any,
    getArgByIndex: jest.fn() as any,
    switchToRpc: jest.fn() as any,
    switchToWs: jest.fn() as any,
    getType: jest.fn() as any,
  });

  it('should throw UNAUTHORIZED if user is missing on request', () => {
    const context = createMockContext(null);
    expect(() => guard.canActivate(context)).toThrow(
      new DomainException(ErrorCode.UNAUTHORIZED, 'Authentication required', HttpStatus.UNAUTHORIZED),
    );
  });

  it('should FAIL-CLOSED (throw MFA_STEP_UP_REQUIRED) if mfaVerified is undefined', () => {
    const user = {
      sub: 'user-123',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      // mfaVerified is omitted / undefined
    };
    const context = createMockContext(user);

    expect(() => guard.canActivate(context)).toThrow(
      new DomainException(
        ErrorCode.MFA_STEP_UP_REQUIRED,
        'This sensitive action requires verified multi-factor authentication (Step-Up)',
        HttpStatus.FORBIDDEN,
      ),
    );
  });

  it('should FAIL-CLOSED (throw MFA_STEP_UP_REQUIRED) if mfaVerified is false', () => {
    const user = {
      sub: 'user-123',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      mfaVerified: false,
    };
    const context = createMockContext(user);

    expect(() => guard.canActivate(context)).toThrow(
      new DomainException(
        ErrorCode.MFA_STEP_UP_REQUIRED,
        'This sensitive action requires verified multi-factor authentication (Step-Up)',
        HttpStatus.FORBIDDEN,
      ),
    );
  });

  it('should ALLOW access if mfaVerified is explicitly true', () => {
    const user = {
      sub: 'user-123',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      mfaVerified: true,
    };
    const context = createMockContext(user);

    expect(guard.canActivate(context)).toBe(true);
  });
});
