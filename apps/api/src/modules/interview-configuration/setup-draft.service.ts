import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { DomainException } from '../platform/filters/all-exceptions.filter';
import {
  ErrorCode,
  SessionMode,
  CompetencyArea,
  InterviewSetupDraftDto,
  ApplyPresetPreviewResponseDto,
  PresetConflictDiffDto,
  FieldSourceDetail,
} from '@ai-interview/contracts';
import {
  CreateSetupDraftRequestDto,
  UpdateSetupDraftRequestDto,
  AnalyzeProfileToDraftRequestDto,
  ResolveConflictsRequestDto,
} from './dto/setup-draft.dto';
import { InterviewConfigurationService } from './interview-configuration.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

@Injectable()
export class SetupDraftService {
  private readonly logger = new Logger(SetupDraftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: InterviewConfigurationService,
    private readonly taxonomyService: TaxonomyService,
  ) {}

  /**
   * Retrieves an active draft for the user or creates a new one with 7-day TTL.
   */
  async getOrCreateActiveDraft(
    userId: string,
    initialData?: CreateSetupDraftRequestDto,
  ): Promise<InterviewSetupDraftDto> {
    const now = new Date();

    const existingDraft = await this.prisma.interviewSetupDraft.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existingDraft) {
      return this.mapDraftToDto(existingDraft);
    }

    // Default configuration fallback
    const [roles, levels, technologies] = await Promise.all([
      this.taxonomyService.getJobRoles(),
      this.taxonomyService.getSeniorityLevels(),
      this.taxonomyService.getTechnologies(),
    ]);

    const defaultRoleId = roles[0]?.id || '';
    const defaultLevelId = levels[0]?.id || '';
    const defaultTechId = technologies[0]?.id ? [technologies[0].id] : [];

    const defaultExpiresAt = new Date();
    defaultExpiresAt.setDate(defaultExpiresAt.getDate() + 7);

    const defaultConfig = {
      jobRoleId: initialData?.configurationDraft?.jobRoleId || defaultRoleId,
      seniorityLevelId: initialData?.configurationDraft?.seniorityLevelId || defaultLevelId,
      technologyIds: initialData?.configurationDraft?.technologyIds || defaultTechId,
      sessionMode: initialData?.configurationDraft?.sessionMode || SessionMode.STANDARD,
      competencyArea: initialData?.configurationDraft?.competencyArea || null,
      language: initialData?.configurationDraft?.language || 'vi',
      totalTurns: initialData?.configurationDraft?.totalTurns || 5,
      isSandbox: initialData?.configurationDraft?.isSandbox || false,
      blueprintId: initialData?.configurationDraft?.blueprintId || null,
    };

    const defaultFieldSources: Record<string, FieldSourceDetail> = {
      jobRoleId: { source: 'default', status: 'suggested' },
      seniorityLevelId: { source: 'default', status: 'suggested' },
      technologyIds: { source: 'default', status: 'suggested' },
      sessionMode: { source: 'default', status: 'suggested' },
      language: { source: 'default', status: 'suggested' },
      totalTurns: { source: 'default', status: 'suggested' },
    };

    const newDraft = await this.prisma.interviewSetupDraft.create({
      data: {
        userId,
        cvProfileId: initialData?.cvProfileId || null,
        jdProfileId: initialData?.jdProfileId || null,
        selectedPresetId: initialData?.selectedPresetId || null,
        extractedProfile: (initialData?.extractedProfile as any) || null,
        configurationDraft: defaultConfig as any,
        fieldSources: (initialData?.fieldSources || defaultFieldSources) as any,
        status: 'ACTIVE',
        expiresAt: defaultExpiresAt,
      },
    });

    return this.mapDraftToDto(newDraft);
  }

  /**
   * Retrieves draft by ID ensuring user ownership.
   */
  async getDraft(userId: string, draftId: string): Promise<InterviewSetupDraftDto> {
    const draft = await this.prisma.interviewSetupDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft || draft.userId !== userId) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Bản nháp cấu hình không tồn tại hoặc bạn không có quyền truy cập',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.mapDraftToDto(draft);
  }

  /**
   * Updates an existing setup draft safely.
   */
  async updateDraft(
    userId: string,
    draftId: string,
    dto: UpdateSetupDraftRequestDto,
  ): Promise<InterviewSetupDraftDto> {
    const draft = await this.prisma.interviewSetupDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft || draft.userId !== userId) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Bản nháp cấu hình không tồn tại hoặc bạn không có quyền truy cập',
        HttpStatus.NOT_FOUND,
      );
    }

    if (draft.status !== 'ACTIVE') {
      throw new DomainException(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Bản nháp cấu hình này không còn ở trạng thái kích hoạt',
        HttpStatus.BAD_REQUEST,
      );
    }

    const currentConfig = (draft.configurationDraft as any) || {};
    const updatedConfig = dto.configurationDraft
      ? { ...currentConfig, ...dto.configurationDraft }
      : currentConfig;

    const currentFieldSources = (draft.fieldSources as any) || {};
    const updatedFieldSources = dto.fieldSources
      ? { ...currentFieldSources, ...dto.fieldSources }
      : currentFieldSources;

    const updated = await this.prisma.interviewSetupDraft.update({
      where: { id: draftId },
      data: {
        cvProfileId: dto.cvProfileId !== undefined ? dto.cvProfileId : draft.cvProfileId,
        jdProfileId: dto.jdProfileId !== undefined ? dto.jdProfileId : draft.jdProfileId,
        selectedPresetId:
          dto.selectedPresetId !== undefined ? dto.selectedPresetId : draft.selectedPresetId,
        extractedProfile:
          dto.extractedProfile !== undefined
            ? (dto.extractedProfile as any)
            : draft.extractedProfile,
        configurationDraft: updatedConfig,
        fieldSources: updatedFieldSources,
        status: dto.status || draft.status,
      },
    });

    return this.mapDraftToDto(updated);
  }

  /**
   * Attaches analyzed profile (CV / JD) to draft and automatically suggests configuration.
   */
  async attachExtractedProfile(
    userId: string,
    draftId: string,
    dto: AnalyzeProfileToDraftRequestDto,
  ): Promise<InterviewSetupDraftDto> {
    const draft = await this.prisma.interviewSetupDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft || draft.userId !== userId) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Bản nháp cấu hình không tồn tại hoặc bạn không có quyền truy cập',
        HttpStatus.NOT_FOUND,
      );
    }

    let extracted = dto.extractedData;

    if (dto.cvProfileId && !extracted) {
      const profile = await this.prisma.parsedProfile.findUnique({
        where: { id: dto.cvProfileId },
        include: { document: true },
      });

      if (profile && profile.document.userId === userId) {
        const match = await this.taxonomyService.matchCvProfile({
          targetRole: profile.targetRole,
          seniorityLevel: profile.seniorityLevel,
          skills: (profile.skills as string[]) || [],
        });

        extracted = {
          documentId: profile.documentId,
          fullName: profile.fullName || undefined,
          targetRole: profile.targetRole || undefined,
          seniorityLevel: profile.seniorityLevel || undefined,
          skills: (profile.skills as string[]) || [],
          experience: (profile.experience as any[]) || [],
          education: (profile.education as string[]) || [],
          rawSummary: profile.rawSummary || undefined,
          matchedJobRoleId: match.jobRoleId || undefined,
          matchedSeniorityLevelId: match.seniorityLevelId || undefined,
          matchedTechnologyIds: match.technologyIds || [],
          unmatchedSkills: match.unmatchedSkills || [],
        };
      }
    }

    const currentConfig = (draft.configurationDraft as any) || {};
    const updatedConfig = { ...currentConfig };
    const currentFieldSources = (draft.fieldSources as any) || {};
    const updatedFieldSources = { ...currentFieldSources };

    if (extracted) {
      if (extracted.matchedJobRoleId) {
        updatedConfig.jobRoleId = extracted.matchedJobRoleId;
        updatedFieldSources.jobRoleId = {
          source: 'cv',
          status: 'suggested',
          originalValue: extracted.targetRole,
        };
      }
      if (extracted.matchedSeniorityLevelId) {
        updatedConfig.seniorityLevelId = extracted.matchedSeniorityLevelId;
        updatedFieldSources.seniorityLevelId = {
          source: 'cv',
          status: 'suggested',
          originalValue: extracted.seniorityLevel,
        };
      }
      if (extracted.matchedTechnologyIds && extracted.matchedTechnologyIds.length > 0) {
        updatedConfig.technologyIds = extracted.matchedTechnologyIds.slice(0, 5);
        updatedFieldSources.technologyIds = {
          source: 'cv',
          status: 'suggested',
          originalValue: extracted.skills,
        };
      }
    }

    const updated = await this.prisma.interviewSetupDraft.update({
      where: { id: draftId },
      data: {
        cvProfileId: dto.cvProfileId || draft.cvProfileId,
        jdProfileId: dto.jdProfileId || draft.jdProfileId,
        extractedProfile: (extracted as any) || draft.extractedProfile,
        configurationDraft: updatedConfig,
        fieldSources: updatedFieldSources,
      },
    });

    return this.mapDraftToDto(updated);
  }

  /**
   * Generates a preview diff when applying a preset against CV/draft state.
   * Does NOT mutate the draft immediately.
   */
  async previewApplyPreset(
    userId: string,
    draftId: string,
    presetId: string,
  ): Promise<ApplyPresetPreviewResponseDto> {
    const draft = await this.prisma.interviewSetupDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft || draft.userId !== userId) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Bản nháp cấu hình không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const preset = await this.prisma.interviewConfigurationPreset.findUnique({
      where: { id: presetId },
      include: {
        jobRole: true,
        seniorityLevel: true,
      },
    });

    if (!preset || preset.userId !== userId) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Preset cấu hình không tồn tại hoặc bạn không có quyền truy cập',
        HttpStatus.NOT_FOUND,
      );
    }

    const [roles, levels, allTechnologies] = await Promise.all([
      this.taxonomyService.getJobRoles(),
      this.taxonomyService.getSeniorityLevels(),
      this.taxonomyService.getTechnologies(),
    ]);

    const techMap = new Map(allTechnologies.map(t => [t.id, t]));
    const roleMap = new Map(roles.map(r => [r.id, r]));
    const levelMap = new Map(levels.map(l => [l.id, l]));

    const currentConfig = (draft.configurationDraft as any) || {};
    const extracted = (draft.extractedProfile as any) || null;
    const diffs: PresetConflictDiffDto[] = [];
    let hasConflicts = false;

    // 1. Role Comparison
    const cvRoleId = extracted?.matchedJobRoleId || currentConfig.jobRoleId;
    const cvRoleObj = cvRoleId ? roleMap.get(cvRoleId) : null;
    const presetRoleObj = roleMap.get(preset.jobRoleId);

    if (cvRoleId && cvRoleId !== preset.jobRoleId) {
      hasConflicts = true;
      diffs.push({
        field: 'jobRoleId',
        label: 'Vị trí công việc (Role)',
        cvValue: cvRoleObj
          ? { id: cvRoleObj.id, name: cvRoleObj.name }
          : { name: extracted?.targetRole || 'Chưa chọn' },
        presetValue: presetRoleObj
          ? { id: presetRoleObj.id, name: presetRoleObj.name }
          : { name: 'Preset' },
        resolvedValue: preset.jobRoleId,
        action: 'apply_preset',
        requiresConfirmation: true,
      });
    }

    // 2. Seniority Level Comparison
    const cvLevelId = extracted?.matchedSeniorityLevelId || currentConfig.seniorityLevelId;
    const cvLevelObj = cvLevelId ? levelMap.get(cvLevelId) : null;
    const presetLevelObj = levelMap.get(preset.seniorityLevelId);

    if (cvLevelId && cvLevelId !== preset.seniorityLevelId) {
      hasConflicts = true;
      diffs.push({
        field: 'seniorityLevelId',
        label: 'Cấp bậc (Seniority Level)',
        cvValue: cvLevelObj
          ? { id: cvLevelObj.id, name: cvLevelObj.name }
          : { name: extracted?.seniorityLevel || 'Chưa chọn' },
        presetValue: presetLevelObj
          ? { id: presetLevelObj.id, name: presetLevelObj.name }
          : { name: 'Preset' },
        resolvedValue: preset.seniorityLevelId,
        action: 'apply_preset',
        requiresConfirmation: true,
      });
    }

    // 3. Skills Merging & Comparison
    const cvTechIds: string[] =
      extracted?.matchedTechnologyIds || currentConfig.technologyIds || [];
    const presetTechIds: string[] = preset.technologyIds || [];

    // Controlled Merge: Preset preferred skills first, then fill up to 5 with CV skills
    const mergedTechIds = Array.from(new Set([...presetTechIds, ...cvTechIds])).slice(0, 5);

    const cvTechNames = cvTechIds.map(id => techMap.get(id)?.name || id);
    const presetTechNames = presetTechIds.map(id => techMap.get(id)?.name || id);
    const mergedTechNames = mergedTechIds.map(id => techMap.get(id)?.name || id);

    const isTechDifferent =
      cvTechIds.length !== presetTechIds.length ||
      !cvTechIds.every(id => presetTechIds.includes(id));

    if (isTechDifferent) {
      diffs.push({
        field: 'technologyIds',
        label: 'Kỹ năng công nghệ (Technologies)',
        cvValue: cvTechNames,
        presetValue: presetTechNames,
        resolvedValue: mergedTechIds,
        action: 'merge',
        requiresConfirmation: cvTechIds.length > 0 && presetTechIds.length > 0,
      });
      if (cvTechIds.length > 0 && presetTechIds.length > 0) {
        hasConflicts = true;
      }
    }

    // 4. Session Mode
    if (currentConfig.sessionMode && currentConfig.sessionMode !== preset.sessionMode) {
      diffs.push({
        field: 'sessionMode',
        label: 'Chế độ phỏng vấn (Mode)',
        cvValue: currentConfig.sessionMode,
        presetValue: preset.sessionMode,
        resolvedValue: preset.sessionMode,
        action: 'apply_preset',
        requiresConfirmation: false,
      });
    }

    // 5. Language
    if (currentConfig.language && currentConfig.language !== preset.language) {
      diffs.push({
        field: 'language',
        label: 'Ngôn ngữ phỏng vấn',
        cvValue: currentConfig.language,
        presetValue: preset.language,
        resolvedValue: preset.language,
        action: 'apply_preset',
        requiresConfirmation: false,
      });
    }

    // 6. Total Turns / Duration
    if (currentConfig.totalTurns && currentConfig.totalTurns !== preset.totalTurns) {
      diffs.push({
        field: 'totalTurns',
        label: 'Số câu hỏi / Thời lượng',
        cvValue: `${currentConfig.totalTurns} lượt`,
        presetValue: `${preset.totalTurns} lượt`,
        resolvedValue: preset.totalTurns,
        action: 'apply_preset',
        requiresConfirmation: false,
      });
    }

    const suggestedMergedConfig = {
      jobRoleId: preset.jobRoleId,
      seniorityLevelId: preset.seniorityLevelId,
      technologyIds: mergedTechIds.length > 0 ? mergedTechIds : preset.technologyIds,
      sessionMode: preset.sessionMode as unknown as SessionMode,
      competencyArea: preset.competencyArea
        ? (preset.competencyArea as unknown as CompetencyArea)
        : undefined,
      language: preset.language,
      totalTurns: preset.totalTurns,
      isSandbox: preset.isSandbox,
      blueprintId: preset.blueprintId || undefined,
    };

    const suggestedFieldSources: Record<string, FieldSourceDetail> = {
      jobRoleId: { source: 'preset', status: 'accepted' },
      seniorityLevelId: { source: 'preset', status: 'accepted' },
      technologyIds: { source: 'manual', status: 'accepted', originalValue: mergedTechNames },
      sessionMode: { source: 'preset', status: 'accepted' },
      language: { source: 'preset', status: 'accepted' },
      totalTurns: { source: 'preset', status: 'accepted' },
    };

    return {
      presetId: preset.id,
      presetName: preset.name,
      hasConflicts,
      diffs,
      suggestedMergedConfig,
      suggestedFieldSources,
    };
  }

  /**
   * Applies confirmed conflict resolutions into the active draft.
   */
  async resolveConflictsAndApply(
    userId: string,
    draftId: string,
    dto: ResolveConflictsRequestDto,
  ): Promise<InterviewSetupDraftDto> {
    const draft = await this.prisma.interviewSetupDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft || draft.userId !== userId) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Bản nháp cấu hình không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const preset = await this.prisma.interviewConfigurationPreset.findUnique({
      where: { id: dto.presetId },
    });

    if (!preset || preset.userId !== userId) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Preset cấu hình không tồn tại',
        HttpStatus.NOT_FOUND,
      );
    }

    const currentConfig = (draft.configurationDraft as any) || {};
    const extracted = (draft.extractedProfile as any) || {};
    const currentFieldSources = (draft.fieldSources as any) || {};

    const updatedConfig = { ...currentConfig };
    const updatedFieldSources = { ...currentFieldSources };

    // Role Resolution
    const roleResolution = dto.resolutions['jobRoleId'] || dto.resolutions['role'];
    if (roleResolution) {
      if (roleResolution.source === 'cv' && extracted.matchedJobRoleId) {
        updatedConfig.jobRoleId = extracted.matchedJobRoleId;
        updatedFieldSources.jobRoleId = { source: 'cv', status: 'accepted' };
      } else if (roleResolution.source === 'preset') {
        updatedConfig.jobRoleId = preset.jobRoleId;
        updatedFieldSources.jobRoleId = { source: 'preset', status: 'accepted' };
      } else if (roleResolution.source === 'manual' && roleResolution.customValue) {
        updatedConfig.jobRoleId = roleResolution.customValue;
        updatedFieldSources.jobRoleId = { source: 'manual', status: 'overridden' };
      }
    } else {
      updatedConfig.jobRoleId = preset.jobRoleId;
      updatedFieldSources.jobRoleId = { source: 'preset', status: 'accepted' };
    }

    // Seniority Resolution
    const levelResolution =
      dto.resolutions['seniorityLevelId'] || dto.resolutions['seniorityLevel'];
    if (levelResolution) {
      if (levelResolution.source === 'cv' && extracted.matchedSeniorityLevelId) {
        updatedConfig.seniorityLevelId = extracted.matchedSeniorityLevelId;
        updatedFieldSources.seniorityLevelId = { source: 'cv', status: 'accepted' };
      } else if (levelResolution.source === 'preset') {
        updatedConfig.seniorityLevelId = preset.seniorityLevelId;
        updatedFieldSources.seniorityLevelId = { source: 'preset', status: 'accepted' };
      } else if (levelResolution.source === 'manual' && levelResolution.customValue) {
        updatedConfig.seniorityLevelId = levelResolution.customValue;
        updatedFieldSources.seniorityLevelId = { source: 'manual', status: 'overridden' };
      }
    } else {
      updatedConfig.seniorityLevelId = preset.seniorityLevelId;
      updatedFieldSources.seniorityLevelId = { source: 'preset', status: 'accepted' };
    }

    // Skills Resolution
    const techResolution = dto.resolutions['technologyIds'] || dto.resolutions['skills'];
    if (techResolution) {
      if (techResolution.source === 'cv' && extracted.matchedTechnologyIds?.length > 0) {
        updatedConfig.technologyIds = extracted.matchedTechnologyIds.slice(0, 5);
        updatedFieldSources.technologyIds = { source: 'cv', status: 'accepted' };
      } else if (techResolution.source === 'preset') {
        updatedConfig.technologyIds = preset.technologyIds;
        updatedFieldSources.technologyIds = { source: 'preset', status: 'accepted' };
      } else if (techResolution.source === 'manual') {
        const customTechs = Array.isArray(techResolution.customValue)
          ? techResolution.customValue
          : [];
        if (customTechs.length > 0) {
          updatedConfig.technologyIds = customTechs.slice(0, 5);
          updatedFieldSources.technologyIds = { source: 'manual', status: 'overridden' };
        } else {
          // Merge preset + CV
          const merged = Array.from(
            new Set([...preset.technologyIds, ...(extracted.matchedTechnologyIds || [])]),
          ).slice(0, 5);
          updatedConfig.technologyIds = merged;
          updatedFieldSources.technologyIds = { source: 'manual', status: 'accepted' };
        }
      }
    } else {
      const merged = Array.from(
        new Set([...preset.technologyIds, ...(extracted.matchedTechnologyIds || [])]),
      ).slice(0, 5);
      updatedConfig.technologyIds = merged;
      updatedFieldSources.technologyIds = { source: 'manual', status: 'accepted' };
    }

    // Mode, Language, TotalTurns, Sandbox, Blueprint from Preset
    updatedConfig.sessionMode = preset.sessionMode;
    updatedFieldSources.sessionMode = { source: 'preset', status: 'accepted' };

    updatedConfig.language = preset.language;
    updatedFieldSources.language = { source: 'preset', status: 'accepted' };

    updatedConfig.totalTurns = preset.totalTurns;
    updatedFieldSources.totalTurns = { source: 'preset', status: 'accepted' };

    updatedConfig.isSandbox = preset.isSandbox;
    updatedConfig.blueprintId = preset.blueprintId || null;
    if (preset.competencyArea) {
      updatedConfig.competencyArea = preset.competencyArea;
    }

    const updated = await this.prisma.interviewSetupDraft.update({
      where: { id: draftId },
      data: {
        selectedPresetId: dto.presetId,
        configurationDraft: updatedConfig,
        fieldSources: updatedFieldSources,
      },
    });

    return this.mapDraftToDto(updated);
  }

  /**
   * Completes a draft when session is created.
   */
  async completeDraft(userId: string, draftId: string): Promise<void> {
    try {
      await this.prisma.interviewSetupDraft.updateMany({
        where: { id: draftId, userId },
        data: { status: 'COMPLETED' },
      });
    } catch (err: any) {
      this.logger.warn(`Could not complete draft ${draftId}: ${err.message}`);
    }
  }

  private mapDraftToDto(draft: any): InterviewSetupDraftDto {
    return {
      id: draft.id,
      userId: draft.userId,
      cvProfileId: draft.cvProfileId,
      jdProfileId: draft.jdProfileId,
      selectedPresetId: draft.selectedPresetId,
      extractedProfile: draft.extractedProfile,
      configurationDraft: draft.configurationDraft,
      fieldSources: draft.fieldSources,
      status: draft.status,
      expiresAt: draft.expiresAt ? draft.expiresAt.toISOString() : null,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }
}
