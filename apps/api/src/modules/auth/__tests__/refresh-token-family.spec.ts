import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditAction, ErrorCode, UserRole, UserStatus } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { TotpUtil } from '../utils/totp.util';
import * as crypto from 'crypto';

describe('RefreshToken Family & Security (P1-008, P1-001)', () => {
  let authService: AuthService;

  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    recoveryCode: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
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

  it('revokes ONLY the compromised family upon token replay detection', async () => {
    const rawToken = 'compromised-token-123';
    const tokenHash = hashToken(rawToken);
    const familyId = 'family-alpha-111';
    const userId = 'user-999';

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-rec-1',
      userId,
      familyId,
      tokenHash,
      isRevoked: true, // ALREADY REVOKED (Replay attack scenario)
      expiresAt: new Date(Date.now() + 100000),
      user: {
        id: userId,
        email: 'victim@example.com',
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
      },
    });

    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.auditLog.create.mockResolvedValue({});

    await expect(authService.refreshTokens(rawToken)).rejects.toThrow(DomainException);

    // Verifies revocation was scoped to the compromised familyId
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId, isRevoked: false },
      data: { isRevoked: true },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.TOKEN_REUSE_DETECTED,
        userId,
        details: expect.objectContaining({ familyId }),
      }),
    });
  });

  it('serializes concurrent rotation so family revocation cannot race a child insert', async () => {
    const familyId = 'family-race-111';
    const storedToken = {
      id: 'token-race-1',
      userId: 'user-race-1',
      familyId,
      isRevoked: false,
      mfaVerified: false,
      expiresAt: new Date(Date.now() + 100000),
      user: {
        id: 'user-race-1',
        email: 'race@example.com',
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        createdAt: new Date(),
        profile: null,
      },
    };
    mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken);

    let tokenAvailable = true;
    let familyRevoked = false;
    let transactionTail = Promise.resolve();
    const events: string[] = [];
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const run = transactionTail.then(async () => {
        const tx = {
          refreshToken: {
            updateMany: jest.fn(async ({ where }: any) => {
              if (where.id === storedToken.id) {
                if (!tokenAvailable) return { count: 0 };
                tokenAvailable = false;
                events.push('source-revoked');
                return { count: 1 };
              }
              if (where.familyId === familyId) {
                familyRevoked = true;
                events.push('family-revoked');
              }
              return { count: 1 };
            }),
            create: jest.fn(async () => {
              events.push('child-created');
              if (familyRevoked) throw new Error('child inserted after family revocation');
              return { id: 'token-race-child' };
            }),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
          user: { update: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });
      transactionTail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    });

    const results = await Promise.allSettled([
      authService.refreshTokens('same-refresh-token'),
      authService.refreshTokens('same-refresh-token'),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(events).toEqual(['source-revoked', 'child-created', 'family-revoked']);
  });

  it('invalidates active refresh tokens and increments tokenVersion when MFA is enabled (P1-001)', async () => {
    const userId = 'user-mfa-123';
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'mfa@example.com',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
      mfaSecret: 'encrypted-secret',
      tokenVersion: 0,
      createdAt: new Date('2026-08-26T00:00:00Z'),
    });

    // Mock TotpUtil verify inside authService
    const enableDtoCode = '123456';
    jest.spyOn(TotpUtil, 'verifyToken').mockReturnValue(true);
    jest.spyOn(TotpUtil, 'decryptSecret').mockReturnValue('decrypted-secret');

    mockPrisma.recoveryCode.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.recoveryCode.createMany.mockResolvedValue({ count: 8 });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
    mockPrisma.user.update.mockResolvedValue({
      id: userId,
      email: 'mfa@example.com',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
      mfaEnabled: true,
      tokenVersion: 1,
      createdAt: new Date('2026-08-26T00:00:00Z'),
      profile: null,
    });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await authService.enableMfa(userId, enableDtoCode);
    expect(result.success).toBe(true);

    // Verify all existing refresh tokens for user were revoked
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    // Verify tokenVersion was incremented
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: { mfaEnabled: true, tokenVersion: { increment: 1 } },
        include: { profile: true },
      }),
    );
    expect(result.accessToken).toBe('mock.jwt.token');
    expect(result.refreshToken).toBeDefined();
  });
});
