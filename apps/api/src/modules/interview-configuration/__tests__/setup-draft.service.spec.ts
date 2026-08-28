import { Test, TestingModule } from '@nestjs/testing';
import { SetupDraftService } from '../setup-draft.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { InterviewConfigurationService } from '../interview-configuration.service';
import { TaxonomyService } from '../../taxonomy/taxonomy.service';
import { SessionMode, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

describe('SetupDraftService', () => {
  let service: SetupDraftService;
  let prisma: any;
  let configService: any;
  let taxonomyService: any;

  const mockUser = { id: 'user-111-uuid' };
  const mockOtherUser = { id: 'user-222-uuid' };

  const mockJobRoles = [
    { id: 'role-be-uuid', slug: 'backend-engineer', name: 'Backend Engineer', isActive: true },
    { id: 'role-fe-uuid', slug: 'frontend-engineer', name: 'Frontend Engineer', isActive: true },
  ];

  const mockSeniorityLevels = [
    { id: 'level-mid-uuid', slug: 'mid', name: 'Mid-Level', order: 3, isActive: true },
    { id: 'level-sr-uuid', slug: 'senior', name: 'Senior', order: 4, isActive: true },
  ];

  const mockTechnologies = [
    { id: 'tech-java-uuid', slug: 'java', name: 'Java', category: 'Language', isActive: true },
    {
      id: 'tech-spring-uuid',
      slug: 'spring-boot',
      name: 'Spring Boot',
      category: 'Backend',
      isActive: true,
    },
    { id: 'tech-sql-uuid', slug: 'sql', name: 'SQL', category: 'Database', isActive: true },
    { id: 'tech-redis-uuid', slug: 'redis', name: 'Redis', category: 'Database', isActive: true },
    { id: 'tech-docker-uuid', slug: 'docker', name: 'Docker', category: 'DevOps', isActive: true },
  ];

  const mockPreset = {
    id: 'preset-java-senior',
    userId: mockUser.id,
    name: 'Java Senior Backend',
    description: 'Concurrency and microservices',
    jobRoleId: 'role-be-uuid',
    seniorityLevelId: 'level-sr-uuid',
    technologyIds: ['tech-java-uuid', 'tech-redis-uuid'],
    sessionMode: SessionMode.STANDARD,
    language: 'en',
    totalTurns: 5,
    isSandbox: false,
    isPinned: true,
    useCount: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockActiveDraft = {
    id: 'draft-1-uuid',
    userId: mockUser.id,
    cvProfileId: 'cv-1-uuid',
    jdProfileId: null,
    selectedPresetId: null,
    extractedProfile: {
      targetRole: 'Backend Developer',
      seniorityLevel: 'Mid',
      skills: ['Java', 'Spring Boot', 'SQL'],
      matchedJobRoleId: 'role-be-uuid',
      matchedSeniorityLevelId: 'level-mid-uuid',
      matchedTechnologyIds: ['tech-java-uuid', 'tech-spring-uuid', 'tech-sql-uuid'],
    },
    configurationDraft: {
      jobRoleId: 'role-be-uuid',
      seniorityLevelId: 'level-mid-uuid',
      technologyIds: ['tech-java-uuid', 'tech-spring-uuid', 'tech-sql-uuid'],
      sessionMode: SessionMode.STANDARD,
      language: 'vi',
      totalTurns: 5,
      isSandbox: false,
    },
    fieldSources: {
      jobRoleId: { source: 'cv', status: 'suggested' },
      seniorityLevelId: { source: 'cv', status: 'suggested' },
      technologyIds: { source: 'cv', status: 'suggested' },
    },
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      interviewSetupDraft: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockActiveDraft.id) return Promise.resolve(mockActiveDraft);
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'new-draft-uuid',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }),
        ),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            ...mockActiveDraft,
            ...data,
            updatedAt: new Date(),
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      interviewConfigurationPreset: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockPreset.id) return Promise.resolve(mockPreset);
          return Promise.resolve(null);
        }),
      },
      parsedProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cv-1-uuid',
          fullName: 'Nguyen Van A',
          targetRole: 'Backend Developer',
          seniorityLevel: 'Mid',
          skills: ['Java', 'Spring Boot', 'SQL'],
          document: { userId: mockUser.id },
        }),
      },
    };

    configService = {
      validateConfiguration: jest.fn().mockResolvedValue({ isValid: true, issues: [] }),
    };

    taxonomyService = {
      getJobRoles: jest.fn().mockResolvedValue(mockJobRoles),
      getSeniorityLevels: jest.fn().mockResolvedValue(mockSeniorityLevels),
      getTechnologies: jest.fn().mockResolvedValue(mockTechnologies),
      matchCvProfile: jest.fn().mockResolvedValue({
        jobRoleId: 'role-be-uuid',
        seniorityLevelId: 'level-mid-uuid',
        technologyIds: ['tech-java-uuid', 'tech-spring-uuid', 'tech-sql-uuid'],
        unmatchedSkills: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetupDraftService,
        { provide: PrismaService, useValue: prisma },
        { provide: InterviewConfigurationService, useValue: configService },
        { provide: TaxonomyService, useValue: taxonomyService },
      ],
    }).compile();

    service = module.get<SetupDraftService>(SetupDraftService);
  });

  describe('Draft Lifecycle', () => {
    it('creates a new draft with 7-day TTL if none exists', async () => {
      const draft = await service.getOrCreateActiveDraft(mockUser.id);
      expect(draft.id).toBe('new-draft-uuid');
      expect(draft.status).toBe('ACTIVE');
      expect(prisma.interviewSetupDraft.create).toHaveBeenCalled();
    });

    it('returns existing active draft if one is already active', async () => {
      prisma.interviewSetupDraft.findFirst.mockResolvedValue(mockActiveDraft);
      const draft = await service.getOrCreateActiveDraft(mockUser.id);
      expect(draft.id).toBe(mockActiveDraft.id);
      expect(prisma.interviewSetupDraft.create).not.toHaveBeenCalled();
    });

    it('prevents IDOR access to draft belonging to another user', async () => {
      await expect(service.getDraft(mockOtherUser.id, mockActiveDraft.id)).rejects.toThrow(
        DomainException,
      );
    });
  });

  describe('Conflict Detection & Merge Preview (CV vs Preset)', () => {
    it('detects seniority and language diffs when applying preset to CV-initialized draft', async () => {
      const preview = await service.previewApplyPreset(
        mockUser.id,
        mockActiveDraft.id,
        mockPreset.id,
      );

      expect(preview.presetId).toBe(mockPreset.id);
      expect(preview.presetName).toBe('Java Senior Backend');
      expect(preview.hasConflicts).toBe(true);

      const seniorityDiff = preview.diffs.find(d => d.field === 'seniorityLevelId');
      expect(seniorityDiff).toBeDefined();
      expect(seniorityDiff?.requiresConfirmation).toBe(true);

      const techDiff = preview.diffs.find(d => d.field === 'technologyIds');
      expect(techDiff).toBeDefined();
      expect(techDiff?.action).toBe('merge');
      // Merged skills should include preset skills + CV skills
      expect(techDiff?.resolvedValue).toContain('tech-redis-uuid');
      expect(techDiff?.resolvedValue).toContain('tech-java-uuid');
    });

    it('does not mutate draft during previewApplyPreset', async () => {
      await service.previewApplyPreset(mockUser.id, mockActiveDraft.id, mockPreset.id);
      expect(prisma.interviewSetupDraft.update).not.toHaveBeenCalled();
    });
  });

  describe('Conflict Resolution & Controlled Merge', () => {
    it('resolves conflicts based on explicit user choices and updates fieldSources', async () => {
      const resolutions = {
        seniorityLevelId: { source: 'preset' as const },
        technologyIds: {
          source: 'manual' as const,
          customValue: ['tech-java-uuid', 'tech-redis-uuid', 'tech-docker-uuid'],
        },
      };

      const updated = await service.resolveConflictsAndApply(mockUser.id, mockActiveDraft.id, {
        presetId: mockPreset.id,
        resolutions,
      });

      expect(prisma.interviewSetupDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockActiveDraft.id },
          data: expect.objectContaining({
            selectedPresetId: mockPreset.id,
            configurationDraft: expect.objectContaining({
              seniorityLevelId: mockPreset.seniorityLevelId,
              technologyIds: ['tech-java-uuid', 'tech-redis-uuid', 'tech-docker-uuid'],
            }),
            fieldSources: expect.objectContaining({
              seniorityLevelId: { source: 'preset', status: 'accepted' },
              technologyIds: { source: 'manual', status: 'overridden' },
            }),
          }),
        }),
      );
    });
  });
});
