import { Test, TestingModule } from '@nestjs/testing';
import { InterviewConfigurationController } from '../interview-configuration.controller';
import { InterviewConfigurationService } from '../interview-configuration.service';
import { SessionMode, JwtPayload, UserRole, UserStatus } from '@ai-interview/contracts';

describe('InterviewConfigurationController', () => {
  let controller: InterviewConfigurationController;
  let service: any;

  const mockUser: JwtPayload = {
    sub: 'user-test-id',
    id: 'user-test-id',
    email: 'test@example.com',
    role: UserRole.CANDIDATE,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    service = {
      listPresets: jest.fn().mockResolvedValue([
        {
          id: 'preset-1',
          name: 'My Preset',
          isPinned: true,
          isCompatible: true,
        },
      ]),
      createPreset: jest.fn().mockResolvedValue({
        id: 'preset-new',
        name: 'Created Preset',
      }),
      updatePreset: jest.fn().mockResolvedValue({
        id: 'preset-1',
        name: 'Updated Preset',
      }),
      deletePreset: jest.fn().mockResolvedValue({
        success: true,
        id: 'preset-1',
      }),
      listRecent: jest.fn().mockResolvedValue([
        {
          id: 'recent-1',
          useCount: 3,
        },
      ]),
      validateConfiguration: jest.fn().mockResolvedValue({
        isValid: true,
        fingerprint: 'fp-1',
        issues: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewConfigurationController],
      providers: [{ provide: InterviewConfigurationService, useValue: service }],
    }).compile();

    controller = module.get<InterviewConfigurationController>(InterviewConfigurationController);
  });

  it('delegates listPresets with authenticated userId', async () => {
    const res = await controller.listPresets(mockUser);
    expect(service.listPresets).toHaveBeenCalledWith('user-test-id');
    expect(res).toHaveLength(1);
  });

  it('delegates createPreset with userId and payload', async () => {
    const dto = {
      name: 'New Stack',
      config: {
        jobRoleId: 'role-1',
        seniorityLevelId: 'lvl-1',
        technologyIds: ['tech-1'],
        sessionMode: SessionMode.STANDARD,
      },
    };

    const res = await controller.createPreset(mockUser, dto as any);
    expect(service.createPreset).toHaveBeenCalledWith('user-test-id', dto);
    expect(res.id).toBe('preset-new');
  });

  it('delegates updatePreset with userId, presetId, and updates', async () => {
    const dto = { name: 'Renamed Stack' };
    const res = await controller.updatePreset(mockUser, 'preset-1', dto as any);
    expect(service.updatePreset).toHaveBeenCalledWith('user-test-id', 'preset-1', dto);
    expect(res.name).toBe('Updated Preset');
  });

  it('delegates deletePreset with userId and presetId', async () => {
    const res = await controller.deletePreset(mockUser, 'preset-1');
    expect(service.deletePreset).toHaveBeenCalledWith('user-test-id', 'preset-1');
    expect(res.success).toBe(true);
  });

  it('delegates listRecent with userId and parsed limit', async () => {
    const res = await controller.listRecent(mockUser, '5');
    expect(service.listRecent).toHaveBeenCalledWith('user-test-id', 5);
    expect(res).toHaveLength(1);
  });

  it('delegates validateConfig with config payload', async () => {
    const dto = {
      config: {
        jobRoleId: 'role-1',
        seniorityLevelId: 'lvl-1',
        technologyIds: ['tech-1'],
        sessionMode: SessionMode.STANDARD,
      },
    };

    const res = await controller.validateConfig(mockUser, dto as any);
    expect(service.validateConfiguration).toHaveBeenCalledWith('user-test-id', dto.config);
    expect(res.isValid).toBe(true);
  });
});
