import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import { ErrorCode } from '@ai-interview/contracts';

describe('AdminService', () => {
  let service: AdminService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('prevents an admin from locking their own account', async () => {
    const adminId = 'admin-uuid-123';
    const targetUserId = 'admin-uuid-123';

    await expect(service.lockUser(adminId, targetUserId, 'test reason')).rejects.toThrow(
      DomainException,
    );

    try {
      await service.lockUser(adminId, targetUserId, 'test reason');
    } catch (error: any) {
      expect(error.code).toBe(ErrorCode.SELF_LOCK_FORBIDDEN);
      expect(error.status).toBe(400);
    }
  });
});
