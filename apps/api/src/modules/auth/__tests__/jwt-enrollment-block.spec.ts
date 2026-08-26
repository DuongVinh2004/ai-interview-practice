import { JwtStrategy } from '../strategies/jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';
import { JwtPayload, UserStatus } from '@ai-interview/contracts';

describe('JWT Enrollment Token Block (SEC-003)', () => {
  let strategy: JwtStrategy;
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret-key-32-chars-long-here'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(mockConfigService as any, mockPrisma as any);
  });

  it('should reject mfa_enrollment tokens with UnauthorizedException', async () => {
    const enrollmentPayload: JwtPayload = {
      sub: 'user-123',
      email: 'admin@test.com',
      role: 'ADMIN' as any,
      status: UserStatus.ACTIVE,
      tokenType: 'mfa_enrollment',
      mfaVerified: false,
    };

    await expect(strategy.validate(enrollmentPayload)).rejects.toThrow(UnauthorizedException);
    await expect(strategy.validate(enrollmentPayload)).rejects.toThrow('MFA enrollment required');

    // Ensure DB was never queried — token rejected at gate level
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should reject mfa_challenge tokens with UnauthorizedException', async () => {
    const challengePayload: JwtPayload = {
      sub: 'user-456',
      email: 'admin@test.com',
      role: 'ADMIN' as any,
      status: UserStatus.ACTIVE,
      tokenType: 'mfa_challenge',
      mfaVerified: false,
    };

    await expect(strategy.validate(challengePayload)).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should allow normal access tokens to pass through to DB lookup', async () => {
    const accessPayload: JwtPayload = {
      sub: 'user-789',
      email: 'user@test.com',
      role: 'CANDIDATE' as any,
      status: UserStatus.ACTIVE,
      tokenType: 'access',
      mfaVerified: false,
    };

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-789',
      email: 'user@test.com',
      role: 'CANDIDATE',
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
    });

    const result = await strategy.validate(accessPayload);
    expect(result.sub).toBe('user-789');
    expect(result.tokenType).toBe('access');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-789' },
      select: { id: true, email: true, role: true, status: true, tokenVersion: true },
    });
  });

  it('should treat undefined tokenType as access and allow through', async () => {
    const noTypePayload: JwtPayload = {
      sub: 'user-101',
      email: 'user@test.com',
      role: 'CANDIDATE' as any,
      status: UserStatus.ACTIVE,
      mfaVerified: false,
    };

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-101',
      email: 'user@test.com',
      role: 'CANDIDATE',
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
    });

    const result = await strategy.validate(noTypePayload);
    expect(result.tokenType).toBe('access');
  });
});
