import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { UserRole, UserStatus, ErrorCode } from '@ai-interview/contracts';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

describe('Auth Security Hardening', () => {
  let authService: AuthService;

  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    recoveryCode: {
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    mfaChallenge: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(cb => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock.jwt.token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      if (key === 'jwt.accessSecret') return 'test-secret-min-32-chars-long-test';
      if (key === 'jwt.accessExpiresIn') return '15m';
      if (key === 'MFA_ENCRYPTION_KEY') return 'test-mfa-key-32-chars-minimum-ok';
      return defaultVal;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((cb: any) =>
      typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb),
    );
  });

  const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

  it('increments user.tokenVersion when refresh token replay is detected to revoke active access tokens', async () => {
    const rawToken = 'compromised-token-123';
    const tokenHash = hashToken(rawToken);
    const familyId = 'family-compromised-999';
    const userId = 'user-victim-1';

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-rec-1',
      userId,
      familyId,
      tokenHash,
      isRevoked: true,
      expiresAt: new Date(Date.now() + 100000),
      user: {
        id: userId,
        email: 'victim@example.com',
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
      },
    });

    await expect(authService.refreshTokens(rawToken)).rejects.toThrow(DomainException);

    // Verify tokenVersion incremented for user
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: expect.objectContaining({
          tokenVersion: { increment: 1 },
        }),
      }),
    );
  });

  it('does NOT burn mfa challenge token when recovery code verification fails', async () => {
    const challengeToken = 'valid-mfa-challenge-jwt';
    const jti = 'challenge-jti-123';
    const userId = 'user-mfa-1';

    mockJwtService.verify.mockReturnValue({
      sub: userId,
      jti,
      mfaPending: true,
      tokenType: 'mfa_challenge',
    });

    mockPrisma.mfaChallenge.findUnique.mockResolvedValue({
      jti,
      consumed: false,
    });

    const realHash = await bcrypt.hash('CORRECT-CODE-1', 10);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      mfaEnabled: true,
      recoveryCodes: [
        { id: 'rc-1', codeHash: realHash, isUsed: false },
      ],
    });

    // Provide wrong code
    await expect(
      authService.verifyRecoveryCodeLogin(challengeToken, 'WRONG-CODE-999'),
    ).rejects.toThrow(DomainException);

    // Assert that mfaChallenge was NOT marked consumed
    expect(mockPrisma.mfaChallenge.updateMany).not.toHaveBeenCalled();
  });
});
