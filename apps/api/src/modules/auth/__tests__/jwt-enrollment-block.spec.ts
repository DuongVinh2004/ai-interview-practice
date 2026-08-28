import { JwtStrategy } from '../strategies/jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';
import { JwtPayload, UserRole, UserStatus } from '@ai-interview/contracts';

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

  const request = (path = '/api/v1/interviews', method = 'GET') =>
    ({ originalUrl: path, path, method }) as any;

  it('should reject mfa_enrollment tokens with UnauthorizedException', async () => {
    const enrollmentPayload: JwtPayload = {
      sub: 'user-123',
      email: 'admin@test.com',
      role: 'ADMIN' as any,
      status: UserStatus.ACTIVE,
      tokenType: 'mfa_enrollment',
      mfaVerified: false,
    };

    await expect(strategy.validate(request(), enrollmentPayload)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(strategy.validate(request(), enrollmentPayload)).rejects.toThrow(
      'MFA enrollment required',
    );

    // Ensure DB was never queried — token rejected at gate level
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(['/api/v1/auth/mfa/setup', '/api/v1/auth/mfa/enable'])(
    'allows an enrollment token only on POST %s',
    async path => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'admin@test.com',
        role: 'ADMIN',
        status: UserStatus.ACTIVE,
        tokenVersion: 0,
        mfaEnabled: false,
      });
      const result = await strategy.validate(request(path, 'POST'), {
        sub: 'user-123',
        email: 'admin@test.com',
        role: 'ADMIN' as any,
        status: UserStatus.ACTIVE,
        tokenType: 'mfa_enrollment',
        tokenVersion: 0,
        mfaVerified: false,
      });
      expect(result.tokenType).toBe('mfa_enrollment');
    },
  );

  it('should reject mfa_challenge tokens with UnauthorizedException', async () => {
    const challengePayload: JwtPayload = {
      sub: 'user-456',
      email: 'admin@test.com',
      role: 'ADMIN' as any,
      status: UserStatus.ACTIVE,
      tokenType: 'mfa_challenge',
      mfaVerified: false,
    };

    await expect(strategy.validate(request(), challengePayload)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(['VOICE_TICKET', 'unexpected'])(
    'rejects token type %s when it is presented as an HTTP bearer token',
    async tokenType => {
      await expect(
        strategy.validate(request(), {
          sub: 'user-voice',
          email: 'user@test.com',
          role: UserRole.CANDIDATE,
          status: UserStatus.ACTIVE,
          tokenType: tokenType as any,
          mfaVerified: false,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

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
      tokenVersion: 0,
      mfaEnabled: false,
    });

    const result = await strategy.validate(request(), accessPayload);
    expect(result).toBeDefined();
    expect(result.id).toBe('user-789');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-789' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        tokenVersion: true,
        mfaEnabled: true,
      },
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
      mfaEnabled: false,
    });

    const result = await strategy.validate(request(), noTypePayload);
    expect(result.tokenType).toBe('access');
  });

  it('rejects an admin access claim when MFA is not currently enabled in the database', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin-legacy',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      mfaEnabled: false,
    });

    await expect(
      strategy.validate(request('/api/v1/admin/users'), {
        sub: 'admin-legacy',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        tokenType: 'access',
        tokenVersion: 0,
        mfaVerified: true,
      }),
    ).rejects.toThrow('Administrator session requires verified multi-factor authentication');
  });

  it('rejects a stale enrollment token after MFA has been enabled', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin-enrolled',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      mfaEnabled: true,
    });

    await expect(
      strategy.validate(request('/api/v1/auth/mfa/setup', 'POST'), {
        sub: 'admin-enrolled',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        tokenType: 'mfa_enrollment',
        tokenVersion: 0,
        mfaVerified: false,
      }),
    ).rejects.toThrow('Administrator session requires verified multi-factor authentication');
  });
});
