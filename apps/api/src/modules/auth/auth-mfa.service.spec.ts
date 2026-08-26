import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { TotpUtil } from './utils/totp.util';
import { UserRole, UserStatus, ErrorCode } from '@ai-interview/contracts';

describe('AuthService MFA & Recovery Codes (Epic 8)', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      recoveryCode: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(actions =>
        typeof actions === 'function' ? actions(prisma) : Promise.all(actions),
      ),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'jwt.accessSecret') return 'test-secret';
        if (key === 'jwt.accessExpiresIn') return '15m';
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('TotpUtil', () => {
    it('generates, encodes and verifies TOTP tokens correctly (RFC 6238)', () => {
      const secret = TotpUtil.generateSecret(20);
      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThanOrEqual(16);

      const token = TotpUtil.generateToken(secret);
      expect(token).toMatch(/^\d{6}$/);

      const isValid = TotpUtil.verifyToken(secret, token);
      expect(isValid).toBe(true);

      const isInvalid = TotpUtil.verifyToken(secret, '000000');
      expect(isInvalid).toBe(false);
    });

    it('generates 8 unique recovery codes with XXXX-XXXX-XX format', () => {
      const codes = TotpUtil.generateRecoveryCodes(8);
      expect(codes.length).toBe(8);
      codes.forEach(c => {
        expect(c).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/);
      });
    });

    it('round-trips encrypted secrets and rejects a tampered authentication tag', () => {
      const secret = TotpUtil.generateSecret(20);
      const encrypted = TotpUtil.encryptSecret(secret, 'unit-test-encryption-key');

      expect(TotpUtil.decryptSecret(encrypted, 'unit-test-encryption-key')).toBe(secret);

      const [iv, tag, ciphertext] = encrypted.split(':');
      const tamperedTag = `${tag.slice(0, -2)}${tag.slice(-2) === '00' ? '01' : '00'}`;
      expect(
        TotpUtil.decryptSecret(`${iv}:${tamperedTag}:${ciphertext}`, 'unit-test-encryption-key'),
      ).not.toBe(secret);
    });
  });

  describe('setupMfa', () => {
    it('initiates MFA setup by generating secret and otpauth URL', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'candidate@example.com',
        mfaEnabled: false,
      });
      prisma.user.update.mockResolvedValue({});

      const res = await service.setupMfa('user-1');
      expect(res.secret).toBeDefined();
      expect(res.otpauthUrl).toContain('otpauth://totp/');
      expect(res.accountName).toBe('candidate@example.com');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('throws error if MFA is already enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'candidate@example.com',
        mfaEnabled: true,
      });

      await expect(service.setupMfa('user-1')).rejects.toThrow();
    });
  });

  describe('enableMfa', () => {
    it('enables MFA and generates 8 hashed recovery codes on valid TOTP code', async () => {
      const secret = TotpUtil.generateSecret(20);
      const validToken = TotpUtil.generateToken(secret);

      const user = {
        id: 'user-1',
        email: 'candidate@example.com',
        mfaSecret: secret,
        mfaEnabled: false,
        tokenVersion: 0,
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        profile: { id: 'profile-1', fullName: 'Candidate' },
      };
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({
        ...user,
        mfaEnabled: true,
        tokenVersion: 1,
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'replacement-refresh-token' });

      const res = await service.enableMfa('user-1', validToken);
      expect(res.success).toBe(true);
      expect(res.mfaEnabled).toBe(true);
      expect(res.recoveryCodes.length).toBe(8);
      expect(res.accessToken).toBe('mock-jwt-token');
      expect(res.refreshToken).toBeDefined();
      expect(res.user?.mfaEnabled).toBe(true);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 1, mfaVerified: true }),
        expect.anything(),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('rejects invalid TOTP verification code', async () => {
      const secret = TotpUtil.generateSecret(20);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'candidate@example.com',
        mfaSecret: secret,
        mfaEnabled: false,
      });

      await expect(service.enableMfa('user-1', '000000')).rejects.toThrow();
    });
  });

  describe('login with MFA', () => {
    it('returns mfaRequired challenge when user has mfaEnabled', async () => {
      const passwordHash = await bcrypt.hash('Password123', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        mfaEnabled: true,
        profile: { fullName: 'Admin' },
      });

      const res = await service.login({
        email: 'admin@example.com',
        password: 'Password123',
      });

      expect(res.mfaRequired).toBe(true);
      expect(res.mfaSessionToken).toBeDefined();
      expect(res.accessToken).toBeUndefined();
    });
  });

  describe('verifyMfaLogin', () => {
    it('completes login with valid TOTP code', async () => {
      const secret = TotpUtil.generateSecret(20);
      const validCode = TotpUtil.generateToken(secret);

      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        mfaPending: true,
      });

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        mfaEnabled: true,
        mfaSecret: secret,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        profile: { fullName: 'Admin' },
      });

      const res = await service.verifyMfaLogin('mock-session-token', validCode);
      expect(res.accessToken).toBeDefined();
      expect(res.refreshToken).toBeDefined();
      expect(res.user?.email).toBe('admin@example.com');
    });
  });

  describe('verifyRecoveryCodeLogin', () => {
    it('completes login with a valid recovery code and atomically marks it used', async () => {
      const recoveryCode = 'ABCD-1234-EF';
      const codeHash = await bcrypt.hash(recoveryCode, 10);

      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        mfaPending: true,
      });

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        mfaEnabled: true,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        profile: { fullName: 'Admin' },
        recoveryCodes: [{ id: 'rc-1', codeHash, isUsed: false }],
      });

      const res = await service.verifyRecoveryCodeLogin('mock-session-token', recoveryCode);
      expect(res.accessToken).toBeDefined();
      expect(res.user?.email).toBe('admin@example.com');
      expect(prisma.recoveryCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rc-1', isUsed: false },
        }),
      );
    });

    it('rejects recovery code when race condition causes updateMany count === 0', async () => {
      const recoveryCode = 'ABCD-1234-EF';
      const codeHash = await bcrypt.hash(recoveryCode, 10);

      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        mfaPending: true,
      });

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        mfaEnabled: true,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        profile: { fullName: 'Admin' },
        recoveryCodes: [{ id: 'rc-1', codeHash, isUsed: false }],
      });

      prisma.recoveryCode.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.verifyRecoveryCodeLogin('mock-session-token', recoveryCode),
      ).rejects.toThrow('Invalid or already used recovery code');
    });
  });

  describe('disableMfa', () => {
    it('disables MFA when password and code are valid', async () => {
      const passwordHash = await bcrypt.hash('Password123', 10);
      const secret = TotpUtil.generateSecret(20);
      const validCode = TotpUtil.generateToken(secret);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash,
        mfaEnabled: true,
        mfaSecret: secret,
        recoveryCodes: [],
      });

      const res = await service.disableMfa('user-1', 'Password123', validCode);
      expect(res.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
