import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { UserRole, UserStatus, AuditAction } from '@ai-interview/contracts';
import * as bcrypt from 'bcrypt';

describe('AuthService (Unit)', () => {
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
      userProfile: {
        create: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: any) =>
          typeof cb === 'function' ? cb(prisma) : Promise.all(cb),
        ),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-access-token'),
    };

    configService = {
      get: jest.fn((key: string, defaultVal?: string) => defaultVal || 'mock-secret'),
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

  describe('refreshTokens', () => {
    it('should successfully rotate tokens when valid active refresh token is provided', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'candidate@example.com',
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        profile: {
          id: 'profile-uuid-1',
          fullName: 'Test Candidate',
          targetRole: 'Backend Developer',
          targetLevel: 'Mid',
          bio: null,
        },
      };

      const mockStoredToken = {
        id: 'token-uuid-1',
        userId: mockUser.id,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: mockUser,
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.create.mockResolvedValue({ id: 'token-uuid-2' });

      const res = await service.refreshTokens('valid-refresh-token-string');

      expect(res.accessToken).toBe('mock-jwt-access-token');
      expect(res.refreshToken).toBeDefined();
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: mockStoredToken.id, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    it('should detect token replay and revoke all user tokens when a revoked token is reused', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'compromised@example.com',
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
      };

      const compromisedToken = {
        id: 'token-uuid-revoked',
        userId: mockUser.id,
        familyId: 'family-uuid-1',
        isRevoked: true, // ALREADY REVOKED
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: mockUser,
      };

      prisma.refreshToken.findUnique.mockResolvedValue(compromisedToken);

      await expect(service.refreshTokens('reused-compromised-token')).rejects.toThrow(
        DomainException,
      );

      // Verify compromised session family was invalidated
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-uuid-1', isRevoked: false },
        data: { isRevoked: true },
      });

      // Verify audit log entry for token reuse
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            action: AuditAction.TOKEN_REUSE_DETECTED,
          }),
        }),
      );
    });

    it('should throw UNAUTHORIZED if token does not exist', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('non-existent-token')).rejects.toThrow(DomainException);
    });
  });

  describe('login (Admin MFA Enrollment & Challenge - AG-PACKET-003 / SEC-003)', () => {
    it('forces MFA setup on admin login when MFA is not enrolled (forceMfaSetup === true)', async () => {
      const passwordHash = await bcrypt.hash('AdminSecret123!', 10);
      const mockAdmin = {
        id: 'admin-uuid-1',
        email: 'admin@ai-interview.dev',
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        mfaEnabled: false, // NOT ENROLLED
        tokenVersion: 0,
        createdAt: new Date(),
        profile: { id: 'prof-1', fullName: 'System Admin' },
      };

      prisma.user.findUnique.mockResolvedValue(mockAdmin);
      prisma.refreshToken.create.mockResolvedValue({ id: 'ref-1' });

      const res = await service.login({
        email: 'admin@ai-interview.dev',
        password: 'AdminSecret123!',
      });

      expect(res.forceMfaSetup).toBe(true);
      expect(res.mfaRequired).toBeUndefined();
      expect(res.mfaSessionToken).toBeUndefined();
      expect(res.refreshToken).toBeDefined();
      expect(res.message).toContain('Administrator accounts require MFA');
      expect(res.accessToken).toBeDefined();
      // Access token was generated with mfaVerified = false
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'admin-uuid-1',
          role: UserRole.ADMIN,
          mfaVerified: false,
        }),
        expect.anything(),
      );
    });

    it('requires MFA challenge on admin login when MFA is already enrolled (mfaRequired === true)', async () => {
      const passwordHash = await bcrypt.hash('AdminSecret123!', 10);
      const mockAdmin = {
        id: 'admin-uuid-1',
        email: 'admin@ai-interview.dev',
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        mfaEnabled: true, // ENROLLED
        tokenVersion: 0,
        createdAt: new Date(),
        profile: { id: 'prof-1', fullName: 'System Admin' },
      };

      prisma.user.findUnique.mockResolvedValue(mockAdmin);
      jwtService.sign.mockReturnValueOnce('mock-mfa-session-token');

      const res = await service.login({
        email: 'admin@ai-interview.dev',
        password: 'AdminSecret123!',
      });

      expect(res.mfaRequired).toBe(true);
      expect(res.mfaSessionToken).toBe('mock-mfa-session-token');
      expect(res.expiresIn).toBe(300);
    });

    it('allows Candidate without MFA to login directly without forceMfaSetup or mfaRequired', async () => {
      const passwordHash = await bcrypt.hash('CandidatePass123!', 10);
      const mockCandidate = {
        id: 'cand-uuid-1',
        email: 'cand@example.com',
        passwordHash,
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        tokenVersion: 0,
        createdAt: new Date(),
        profile: { id: 'prof-2', fullName: 'Regular Candidate' },
      };

      prisma.user.findUnique.mockResolvedValue(mockCandidate);
      prisma.refreshToken.create.mockResolvedValue({ id: 'ref-2' });

      const res = await service.login({
        email: 'cand@example.com',
        password: 'CandidatePass123!',
      });

      expect(res.forceMfaSetup).toBeUndefined();
      expect(res.mfaRequired).toBeUndefined();
      expect(res.accessToken).toBe('mock-jwt-access-token');
    });
  });

  describe('logout (Server-side Session Revocation - AG-PACKET-004 / SEC-012)', () => {
    it('revokes refresh tokens and increments tokenVersion server-side on logout', async () => {
      const userId = 'user-uuid-1';
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'ref-1',
        userId,
        familyId: 'family-1',
      });

      await service.logout(userId, 'valid-refresh-token-string');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyId: 'family-1', isRevoked: false },
          data: { isRevoked: true },
        }),
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
    });

    it('rejects previously issued access token in validateAccessToken after tokenVersion increment (fails closed)', async () => {
      jwtService.verify = jest.fn().mockReturnValue({
        sub: 'user-uuid-1',
        tokenVersion: 1, // Pre-logout tokenVersion
        mfaVerified: true,
      });

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'user@example.com',
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
        tokenVersion: 2, // Post-logout incremented tokenVersion
      });

      await expect(service.validateAccessToken('old-pre-logout-jwt')).rejects.toThrow(
        DomainException,
      );
      try {
        await service.validateAccessToken('old-pre-logout-jwt');
      } catch (err: any) {
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toContain('Session invalidated');
      }
    });
  });
});
