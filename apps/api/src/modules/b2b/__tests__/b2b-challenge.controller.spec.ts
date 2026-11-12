import { Test, TestingModule } from '@nestjs/testing';
import { B2bChallengeController } from '../controllers/b2b-challenge.controller';
import { B2bChallengeService } from '../services/b2b-challenge.service';
import { TenantRoleGuard } from '../guards/tenant-role.guard';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../platform/prisma/prisma.service';

describe('B2bChallengeController (Roadmap 2.2)', () => {
  let controller: B2bChallengeController;
  let service: any;

  beforeEach(async () => {
    service = {
      validateChallenge: jest.fn().mockResolvedValue({ overallPass: true }),
      createCustomChallenge: jest.fn().mockResolvedValue({ challenge: { id: 'c-1' } }),
      listTenantChallenges: jest.fn().mockResolvedValue([{ id: 'c-1' }]),
      getTenantChallenge: jest.fn().mockResolvedValue({ id: 'c-1' }),
      publishTenantChallenge: jest.fn().mockResolvedValue({ id: 'c-1', status: 'PUBLISHED' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [B2bChallengeController],
      providers: [
        { provide: B2bChallengeService, useValue: service },
        { provide: Reflector, useValue: new Reflector() },
        { provide: PrismaService, useValue: {} },
        TenantRoleGuard,
      ],
    }).compile();

    controller = module.get<B2bChallengeController>(B2bChallengeController);
  });

  it('validateChallenge: should call service.validateChallenge with body', async () => {
    const body: any = {
      manifest: { slug: 'test' },
      visibleFilesContent: {},
      hiddenFilesContent: {},
    };

    const res = await controller.validateChallenge(body);
    expect(res).toEqual({ overallPass: true });
    expect(service.validateChallenge).toHaveBeenCalledWith(body);
  });

  it('createCustomChallenge: should pass tenantId and userId from request context', async () => {
    const body: any = {
      manifest: { slug: 'test' },
      visibleFilesContent: {},
      hiddenFilesContent: {},
    };
    const req: any = { tenantId: 'tenant-123' };

    const res = await controller.createChallenge('user-456', req, body);
    expect(res).toEqual({ challenge: { id: 'c-1' } });
    expect(service.createCustomChallenge).toHaveBeenCalledWith({
      tenantId: 'tenant-123',
      userId: 'user-456',
      manifest: body.manifest,
      visibleFilesContent: body.visibleFilesContent,
      hiddenFilesContent: body.hiddenFilesContent,
    });
  });

  it('listChallenges: should list challenges for tenant', async () => {
    const req: any = { tenantId: 'tenant-123' };
    const res = await controller.listChallenges('user-456', req);
    expect(res).toEqual([{ id: 'c-1' }]);
    expect(service.listTenantChallenges).toHaveBeenCalledWith('tenant-123', 'user-456');
  });

  it('getChallenge: should get challenge by ID', async () => {
    const req: any = { tenantId: 'tenant-123' };
    const res = await controller.getChallenge('user-456', req, 'c-1');
    expect(res).toEqual({ id: 'c-1' });
    expect(service.getTenantChallenge).toHaveBeenCalledWith('c-1', 'tenant-123', 'user-456');
  });

  it('publishChallenge: should publish challenge by ID', async () => {
    const req: any = { tenantId: 'tenant-123' };
    const res = await controller.publishChallenge('user-456', req, 'c-1');
    expect(res).toEqual({ id: 'c-1', status: 'PUBLISHED' });
    expect(service.publishTenantChallenge).toHaveBeenCalledWith('c-1', 'tenant-123', 'user-456');
  });
});
