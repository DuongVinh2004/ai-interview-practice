import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { DomainException } from '../../platform/filters/all-exceptions.filter';
import { UserRole, UserStatus, AuditAction, ErrorCode } from '@ai-interview/contracts';

describe('AuthService — Password Reset & Email Verification (TDD)', () => {
  let service: AuthService;
  let prisma: any;
  let emailService: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      emailVerificationToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      refreshToken: {
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

    emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key === 'app.frontendUrl') return 'https://ai-interview.dev';
              return def || 'mock-val';
            }),
          },
        },
        { provide: EmailService, useValue: emailService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('forgotPassword', () => {
    it('returns generic message without sending email when user is not found (anti-enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await service.forgotPassword({ email: 'nonexistent@example.com' });

      expect(res.message).toContain('If an account exists');
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('generates single-use token, persists hash, sends email, and logs audit when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-123',
        email: 'user@example.com',
        profile: { fullName: 'Alex Tran' },
      });
      prisma.passwordResetToken.create.mockResolvedValue({});

      const res = await service.forgotPassword({ email: 'user@example.com' });

      expect(res.message).toContain('If an account exists');
      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u-123',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          userName: 'Alex Tran',
          resetUrl: expect.stringContaining('/reset-password?token='),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u-123',
            action: AuditAction.PASSWORD_RESET_REQUESTED,
          }),
        }),
      );
    });
  });

  describe('resetPassword', () => {
    it('throws DomainException if token does not exist or has expired', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'NewPassword123' }),
      ).rejects.toThrow(DomainException);
    });

    it('throws DomainException if token was already used', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        userId: 'u-123',
        isUsed: true,
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.resetPassword({ token: 'used-token', newPassword: 'NewPassword123' }),
      ).rejects.toThrow(DomainException);
    });

    it('successfully resets password, revokes refresh tokens, increments tokenVersion and marks token used', async () => {
      const token = 'valid-secure-token-123';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        userId: 'u-123',
        tokenHash,
        isUsed: false,
        expiresAt: new Date(Date.now() + 60000),
        user: { id: 'u-123', tokenVersion: 1 },
      });
      prisma.user.update.mockResolvedValue({});
      prisma.passwordResetToken.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const res = await service.resetPassword({ token, newPassword: 'NewPassword123' });

      expect(res.message).toContain('Password has been reset successfully');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-123' },
          data: expect.objectContaining({
            tokenVersion: { increment: 1 },
          }),
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-123' },
        data: { isRevoked: true },
      });
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tok-1' },
          data: expect.objectContaining({ isUsed: true }),
        }),
      );
    });
  });

  describe('verifyEmail', () => {
    it('throws DomainException if verification token is invalid or expired', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail({ token: 'invalid-token' })).rejects.toThrow(
        DomainException,
      );
    });

    it('verifies user email and marks verification token as used', async () => {
      const token = 'email-verify-token-xyz';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'evt-1',
        userId: 'u-123',
        tokenHash,
        isUsed: false,
        expiresAt: new Date(Date.now() + 3600000),
      });
      prisma.user.update.mockResolvedValue({});
      prisma.emailVerificationToken.update.mockResolvedValue({});

      const res = await service.verifyEmail({ token });

      expect(res.message).toContain('Email has been verified successfully');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-123' },
          data: expect.objectContaining({
            isEmailVerified: true,
            emailVerifiedAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-1' },
          data: expect.objectContaining({ isUsed: true }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u-123',
            action: AuditAction.EMAIL_VERIFIED,
          }),
        }),
      );
    });
  });

  describe('resendVerification', () => {
    it('returns generic message without action if user not found or already verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-123',
        email: 'verified@example.com',
        isEmailVerified: true,
      });

      const res = await service.resendVerification({ email: 'verified@example.com' });

      expect(res.message).toContain('verification link has been sent');
      expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
    });

    it('creates new token and sends verification email if user exists and is unverified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-123',
        email: 'unverified@example.com',
        isEmailVerified: false,
        profile: { fullName: 'Alex Tran' },
      });
      prisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.emailVerificationToken.create.mockResolvedValue({});

      const res = await service.resendVerification({ email: 'unverified@example.com' });

      expect(res.message).toContain('verification link has been sent');
      expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalledWith(
        'unverified@example.com',
        expect.objectContaining({
          userName: 'Alex Tran',
          verificationUrl: expect.stringContaining('/verify-email?token='),
        }),
      );
    });
  });
});
