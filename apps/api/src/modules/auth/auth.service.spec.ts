import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { UserRole, UserStatus, AuditAction } from '@ai-interview/contracts';

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
});
