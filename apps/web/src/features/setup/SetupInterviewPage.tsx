import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  JobRoleDto,
  SeniorityLevelDto,
  TechnologyDto,
  SessionMode,
  CompetencyArea,
  InterviewBlueprintDto,
  InterviewConfigurationPresetDto,
  ErrorCode,
} from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  Sparkles,
  Check,
  Layers,
  Code,
  Briefcase,
  Target,
  FlaskConical,
  GraduationCap,
  Zap,
  Mic,
  AlertCircle,
  RotateCcw,
  Crown,
  ArrowUpRight,
  Search,
  Bookmark,
  X,
} from 'lucide-react';
import { CvHeroSection, ExtractedProfileData } from '../../components/setup/CvHeroSection';
import { SavedConfigurationsSection } from '../../components/setup/SavedConfigurationsSection';
import { PresetConflictModal, ConflictDiffItem } from '../../components/setup/PresetConflictModal';
import { StickySetupSummary, FieldSourceTracking } from '../../components/setup/StickySetupSummary';
import { JdInputModal } from '../../components/setup/JdInputModal';
import { ExistingProfilesModal } from '../../components/setup/ExistingProfilesModal';
import { useDocumentParser } from '../../hooks/useDocumentParser';
import { useBilling } from '../../hooks/useBilling';
import { useAuthStore } from '../../stores/auth.store';
import { getNextUpgradePlan } from '../../lib/plan-tier.utils';

const COMPETENCY_OPTIONS = [
  {
    area: CompetencyArea.SYSTEM_DESIGN,
    label: 'Thiết Kế Hệ Thống & Khả Năng Mở Rộng',
    labelEn: 'System Design & Scalability',
  },
  {
    area: CompetencyArea.LANGUAGE_CORE,
    label: 'Nền Tảng Ngôn Ngữ & Cốt Lõi',
    labelEn: 'Core Language & Fundamentals',
  },
  {
    area: CompetencyArea.DATABASE_CONCURRENCY,
    label: 'Cơ Sở Dữ Liệu & Xử Lý Đồng Thời',
    labelEn: 'Databases & Concurrency',
  },
  {
    area: CompetencyArea.ARCHITECTURE_PATTERNS,
    label: 'Kiến Trúc & Mẫu Thiết Kế',
    labelEn: 'Architecture & Patterns',
  },
  {
    area: CompetencyArea.RESILIENCE_SECURITY,
    label: 'Độ Tin Cậy & Bảo Mật',
    labelEn: 'Resilience & Security',
  },
];

const TECH_CATEGORIES = [
  { key: 'ALL', labelVi: 'Tất cả', labelEn: 'All' },
  { key: 'Language', labelVi: 'Ngôn ngữ', labelEn: 'Languages' },
  { key: 'Frontend', labelVi: 'Frontend', labelEn: 'Frontend' },
  { key: 'Mobile', labelVi: 'Mobile', labelEn: 'Mobile' },
  { key: 'Backend', labelVi: 'Backend', labelEn: 'Backend' },
  { key: 'Database', labelVi: 'Database & Cache', labelEn: 'Databases' },
  { key: 'API', labelVi: 'API & Streaming', labelEn: 'API & Streaming' },
  { key: 'DevOps', labelVi: 'Cloud & DevOps', labelEn: 'Cloud & DevOps' },
  { key: 'AI/Data', labelVi: 'AI & Data', labelEn: 'AI & Data' },
  { key: 'Testing', labelVi: 'Kiểm thử', labelEn: 'Testing' },
  { key: 'Security', labelVi: 'Bảo mật', labelEn: 'Security' },
];

export function SetupInterviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language } = useI18nStore();

  const [sessionMode, setSessionMode] = useState<SessionMode>(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'remediation') return SessionMode.FOCUSED_REMEDIATION;
    if (modeParam === 'sandbox') return SessionMode.QUICK_PRACTICE;
    if (modeParam === 'voice') return SessionMode.VOICE_LIVE;
    if (modeParam === 'coding') return SessionMode.CODING;
    if (modeParam === 'behavioral') return SessionMode.BEHAVIORAL;
    if (
      modeParam === 'system_design' ||
      modeParam === 'system-design' ||
      modeParam === 'systemdesign'
    )
      return SessionMode.SYSTEM_DESIGN;
    return SessionMode.STANDARD;
  });

  const [competencyArea, setCompetencyArea] = useState<CompetencyArea>(() => {
    const compParam = searchParams.get('competency') as CompetencyArea;
    if (compParam && Object.values(CompetencyArea).includes(compParam)) {
      return compParam;
    }
    return CompetencyArea.SYSTEM_DESIGN;
  });

  const [totalTurns, setTotalTurns] = useState<number>(() => {
    const turnsParam = Number(searchParams.get('turns'));
    if (turnsParam >= 1 && turnsParam <= 5) return turnsParam;
    return sessionMode === SessionMode.STANDARD ? 5 : 3;
  });

  const [interviewLanguage, setInterviewLanguage] = useState<string>(() => language || 'vi');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [techSearchQuery, setTechSearchQuery] = useState<string>('');
  const [selectedTechCategory, setSelectedTechCategory] = useState<string>('ALL');

  // Provenance & Reusable Presets Tracking
  const [presetId, setPresetId] = useState<string | undefined>(undefined);
  const [configurationSource, setConfigurationSource] = useState<
    'MANUAL' | 'PRESET' | 'RECENT' | 'BLUEPRINT'
  >('MANUAL');
  const [appliedPresetName, setAppliedPresetName] = useState<string | undefined>(undefined);
  const [fieldSources, setFieldSources] = useState<FieldSourceTracking>({
    role: 'default',
    level: 'default',
    techs: 'default',
    mode: 'default',
    language: 'default',
  });

  // Conflict Diff Modal State
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<InterviewConfigurationPresetDto | null>(null);
  const [conflictDiffs, setConflictDiffs] = useState<ConflictDiffItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{
    message: string;
    isQuotaExceeded?: boolean;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    role?: string;
    level?: string;
    techs?: string;
  }>({});

  // Synchronize default interview language when global UI language switches
  useEffect(() => {
    if (language) {
      setInterviewLanguage(language);
    }
  }, [language]);

  // CV / JD Profile State
  const [extractedCvProfile, setExtractedCvProfile] = useState<ExtractedProfileData | null>(null);
  const [_parsedCvProfile, setParsedCvProfile] = useState<any>(null);
  const [isTailoredExpanded, setIsTailoredExpanded] = useState(false);
  const [activeBlueprint, setActiveBlueprint] = useState<InterviewBlueprintDto | null>(null);
  const [isJdModalOpen, setIsJdModalOpen] = useState(false);
  const [isExistingProfilesModalOpen, setIsExistingProfilesModalOpen] = useState(false);

  const {
    parseCv,
    isParsingCv,
    analyzeJd,
    isAnalyzingJd,
    profiles = [],
    isLoadingProfiles,
  } = useDocumentParser();
  const { user } = useAuthStore();
  const { subscription } = useBilling();
  const isAdmin = user?.role === 'ADMIN';
  const planSlug = subscription?.plan?.slug?.toLowerCase() || 'free';
  const upgradeSuggestion = getNextUpgradePlan(planSlug, isAdmin, language === 'vi');

  const { data: roles = [], isLoading: loadingRoles } = useQuery<JobRoleDto[]>({
    queryKey: ['taxonomies', 'roles'],
    queryFn: () => apiClient('/taxonomies/job-roles'),
  });

  const { data: levels = [], isLoading: loadingLevels } = useQuery<SeniorityLevelDto[]>({
    queryKey: ['taxonomies', 'levels'],
    queryFn: () => apiClient('/taxonomies/levels'),
  });

  const { data: technologies = [], isLoading: loadingTechs } = useQuery<TechnologyDto[]>({
    queryKey: ['taxonomies', 'technologies'],
    queryFn: () => apiClient('/taxonomies/technologies'),
  });

  // Default selections when data loads
  useEffect(() => {
    if (roles.length > 0 && !selectedRole) {
      setSelectedRole(roles[0].id);
    }
  }, [roles, selectedRole]);

  useEffect(() => {
    if (levels.length > 0 && !selectedLevel) {
      setSelectedLevel(levels[0].id);
    }
  }, [levels, selectedLevel]);

  const handleCvParsedSuccess = (res: any) => {
    const profile = res?.parsedProfile;
    const match = res?.taxonomyMatch;
    setParsedCvProfile(profile);

    if (match) {
      if (match.jobRoleId) setSelectedRole(match.jobRoleId);
      if (match.seniorityLevelId) setSelectedLevel(match.seniorityLevelId);
      if (match.technologyIds && match.technologyIds.length > 0) {
        setSelectedTechs(match.technologyIds.slice(0, 5));
      }

      setExtractedCvProfile({
        documentId: profile?.documentId,
        fullName: profile?.fullName,
        targetRole: profile?.targetRole || 'Software Engineer',
        seniorityLevel: profile?.seniorityLevel || 'Mid-Level',
        skills: profile?.skills || [],
        matchedJobRoleId: match.jobRoleId,
        matchedSeniorityLevelId: match.seniorityLevelId,
        matchedTechnologyIds: match.technologyIds || [],
        unmatchedSkills: match.unmatchedSkills || [],
      });

      setFieldSources({
        role: 'cv',
        level: 'cv',
        techs: 'cv',
        mode: 'default',
        language: 'default',
      });

      setValidationErrors({});
    }
  };

  const handleUploadCvFile = async (file: File) => {
    const res = await parseCv({ file });
    handleCvParsedSuccess(res);
  };

  const handleAnalyzeJd = async (jdText: string, roleTitle?: string) => {
    const res = await analyzeJd({ jdText, roleTitle });
    const requiredSkills = Array.isArray(res?.requiredSkills) ? res.requiredSkills : [];
    const preferredSkills = Array.isArray(res?.preferredSkills) ? res.preferredSkills : [];
    const allSkills = [...requiredSkills, ...preferredSkills];

    // Find best matching role
    let matchedRoleId = selectedRole;
    if (res?.roleTitle) {
      const normalizedRole = res.roleTitle.toLowerCase();
      const matchedRole = roles.find(
        r =>
          normalizedRole.includes(r.name.toLowerCase()) ||
          r.name.toLowerCase().includes(normalizedRole),
      );
      if (matchedRole) {
        matchedRoleId = matchedRole.id;
        setSelectedRole(matchedRole.id);
      }
    }

    // Match technologies from skills
    const matchedTechIds: string[] = [];
    technologies.forEach(tech => {
      const techName = tech.name.toLowerCase();
      if (
        allSkills.some(
          skill => skill.toLowerCase().includes(techName) || techName.includes(skill.toLowerCase()),
        )
      ) {
        if (!matchedTechIds.includes(tech.id)) {
          matchedTechIds.push(tech.id);
        }
      }
    });

    if (matchedTechIds.length > 0) {
      setSelectedTechs(matchedTechIds.slice(0, 5));
    }

    setExtractedCvProfile({
      fullName: 'Job Description (JD)',
      targetRole: res?.roleTitle || 'Target Role',
      seniorityLevel: 'Mid-Level',
      skills: allSkills.slice(0, 8),
      matchedJobRoleId: matchedRoleId,
      matchedSeniorityLevelId: selectedLevel,
      matchedTechnologyIds: matchedTechIds,
      unmatchedSkills: [],
    });

    setFieldSources({
      role: 'cv',
      level: 'cv',
      techs: 'cv',
      mode: 'default',
      language: 'default',
    });

    setValidationErrors({});
  };

  const handleSelectExistingProfile = (p: any) => {
    const skills = Array.isArray(p.skills) ? p.skills : [];
    let matchedRoleId = selectedRole;
    let matchedLevelId = selectedLevel;

    // Match role
    if (p.targetRole) {
      const matchedRole = roles.find(
        r =>
          r.name.toLowerCase().includes(p.targetRole.toLowerCase()) ||
          p.targetRole.toLowerCase().includes(r.name.toLowerCase()),
      );
      if (matchedRole) {
        matchedRoleId = matchedRole.id;
        setSelectedRole(matchedRole.id);
      }
    }

    // Match level
    if (p.seniorityLevel) {
      const matchedLevel = levels.find(
        l =>
          l.name.toLowerCase().includes(p.seniorityLevel.toLowerCase()) ||
          p.seniorityLevel.toLowerCase().includes(l.name.toLowerCase()),
      );
      if (matchedLevel) {
        matchedLevelId = matchedLevel.id;
        setSelectedLevel(matchedLevel.id);
      }
    }

    // Match technologies
    const matchedTechIds: string[] = [];
    technologies.forEach(tech => {
      const techName = tech.name.toLowerCase();
      if (
        skills.some(
          (skill: string) =>
            skill.toLowerCase().includes(techName) || techName.includes(skill.toLowerCase()),
        )
      ) {
        if (!matchedTechIds.includes(tech.id)) {
          matchedTechIds.push(tech.id);
        }
      }
    });

    if (matchedTechIds.length > 0) {
      setSelectedTechs(matchedTechIds.slice(0, 5));
    }

    setExtractedCvProfile({
      documentId: p.documentId,
      fullName: p.fullName || p.document?.fileName || 'Hồ sơ đã lưu',
      targetRole: p.targetRole || 'Software Engineer',
      seniorityLevel: p.seniorityLevel || 'Mid-Level',
      skills: skills,
      matchedJobRoleId: matchedRoleId,
      matchedSeniorityLevelId: matchedLevelId,
      matchedTechnologyIds: matchedTechIds,
      unmatchedSkills: [],
    });

    setFieldSources({
      role: 'cv',
      level: 'cv',
      techs: 'cv',
      mode: 'default',
      language: 'default',
    });

    setValidationErrors({});
  };

  const handleResetCv = () => {
    setExtractedCvProfile(null);
    setParsedCvProfile(null);
    setFieldSources(prev => ({ ...prev, role: 'manual', level: 'manual', techs: 'manual' }));
  };

  // Conflict Checking when selecting a Preset
  const handleSelectPreset = (preset: InterviewConfigurationPresetDto) => {
    if (extractedCvProfile) {
      const diffs: ConflictDiffItem[] = [];

      const roleMap = new Map(roles.map(r => [r.id, r]));
      const levelMap = new Map(levels.map(l => [l.id, l]));
      const techMap = new Map(technologies.map(t => [t.id, t]));

      // 1. Role Check
      const cvRoleObj = extractedCvProfile.matchedJobRoleId
        ? roleMap.get(extractedCvProfile.matchedJobRoleId)
        : null;
      const presetRoleObj = roleMap.get(preset.jobRoleId);
      if (
        extractedCvProfile.matchedJobRoleId &&
        extractedCvProfile.matchedJobRoleId !== preset.jobRoleId
      ) {
        diffs.push({
          field: 'jobRoleId',
          label: 'Vị trí công việc (Role)',
          cvValue: cvRoleObj?.name || extractedCvProfile.targetRole || 'CV Role',
          presetValue: presetRoleObj?.name || preset.jobRole?.name || 'Preset Role',
          resolvedValue: preset.jobRoleId,
          action: 'apply_preset',
          requiresConfirmation: true,
        });
      }

      // 2. Level Check
      const cvLevelObj = extractedCvProfile.matchedSeniorityLevelId
        ? levelMap.get(extractedCvProfile.matchedSeniorityLevelId)
        : null;
      const presetLevelObj = levelMap.get(preset.seniorityLevelId);
      if (
        extractedCvProfile.matchedSeniorityLevelId &&
        extractedCvProfile.matchedSeniorityLevelId !== preset.seniorityLevelId
      ) {
        diffs.push({
          field: 'seniorityLevelId',
          label: 'Cấp bậc (Seniority)',
          cvValue: cvLevelObj?.name || extractedCvProfile.seniorityLevel || 'CV Level',
          presetValue: presetLevelObj?.name || preset.seniorityLevel?.name || 'Preset Level',
          resolvedValue: preset.seniorityLevelId,
          action: 'apply_preset',
          requiresConfirmation: true,
        });
      }

      // 3. Techs Check
      const cvTechNames = extractedCvProfile.matchedTechnologyIds.map(
        id => techMap.get(id)?.name || id,
      );
      const presetTechNames = preset.technologyIds.map(id => techMap.get(id)?.name || id);
      const isTechDifferent =
        extractedCvProfile.matchedTechnologyIds.length !== preset.technologyIds.length ||
        !extractedCvProfile.matchedTechnologyIds.every(id => preset.technologyIds.includes(id));

      if (isTechDifferent && extractedCvProfile.matchedTechnologyIds.length > 0) {
        diffs.push({
          field: 'technologyIds',
          label: 'Kỹ năng công nghệ',
          cvValue: cvTechNames,
          presetValue: presetTechNames,
          resolvedValue: Array.from(
            new Set([...preset.technologyIds, ...extractedCvProfile.matchedTechnologyIds]),
          ).slice(0, 5),
          action: 'merge',
          requiresConfirmation: true,
        });
      }

      if (diffs.length > 0) {
        setPendingPreset(preset);
        setConflictDiffs(diffs);
        setIsConflictModalOpen(true);
        return;
      }
    }

    // Direct apply if no conflict
    applyPresetDirectly(preset);
  };

  const applyPresetDirectly = (preset: InterviewConfigurationPresetDto) => {
    setSelectedRole(preset.jobRoleId);
    setSelectedLevel(preset.seniorityLevelId);
    setSelectedTechs(preset.technologyIds || []);
    if (preset.sessionMode) setSessionMode(preset.sessionMode);
    if (preset.competencyArea) setCompetencyArea(preset.competencyArea);
    if (preset.language) setInterviewLanguage(preset.language);
    if (preset.totalTurns) setTotalTurns(preset.totalTurns);
    if (preset.blueprintId) setActiveBlueprint({ id: preset.blueprintId } as any);

    setPresetId(preset.id);
    setConfigurationSource('PRESET');
    setAppliedPresetName(preset.name);
    setFieldSources({
      role: 'preset',
      level: 'preset',
      techs: 'preset',
      mode: 'preset',
      language: 'preset',
    });
    setValidationErrors({});
    setErrorInfo(null);
  };

  // Conflict Modal Handlers
  const handleConflictUseCv = () => {
    if (!pendingPreset || !extractedCvProfile) return;
    if (extractedCvProfile.matchedJobRoleId) setSelectedRole(extractedCvProfile.matchedJobRoleId);
    if (extractedCvProfile.matchedSeniorityLevelId)
      setSelectedLevel(extractedCvProfile.matchedSeniorityLevelId);
    if (extractedCvProfile.matchedTechnologyIds.length > 0) {
      setSelectedTechs(extractedCvProfile.matchedTechnologyIds.slice(0, 5));
    }
    if (pendingPreset.sessionMode) setSessionMode(pendingPreset.sessionMode);
    if (pendingPreset.language) setInterviewLanguage(pendingPreset.language);
    if (pendingPreset.totalTurns) setTotalTurns(pendingPreset.totalTurns);

    setPresetId(pendingPreset.id);
    setConfigurationSource('PRESET');
    setAppliedPresetName(`${pendingPreset.name} (Ưu tiên CV)`);
    setFieldSources({
      role: 'cv',
      level: 'cv',
      techs: 'cv',
      mode: 'preset',
      language: 'preset',
    });
    setIsConflictModalOpen(false);
  };

  const handleConflictApplyPreset = () => {
    if (!pendingPreset) return;
    applyPresetDirectly(pendingPreset);
    setIsConflictModalOpen(false);
  };

  const handleConflictSmartMerge = () => {
    if (!pendingPreset || !extractedCvProfile) return;
    setSelectedRole(pendingPreset.jobRoleId);
    setSelectedLevel(pendingPreset.seniorityLevelId);

    const mergedTechs = Array.from(
      new Set([...pendingPreset.technologyIds, ...extractedCvProfile.matchedTechnologyIds]),
    ).slice(0, 5);
    setSelectedTechs(mergedTechs);

    if (pendingPreset.sessionMode) setSessionMode(pendingPreset.sessionMode);
    if (pendingPreset.language) setInterviewLanguage(pendingPreset.language);
    if (pendingPreset.totalTurns) setTotalTurns(pendingPreset.totalTurns);

    setPresetId(pendingPreset.id);
    setConfigurationSource('PRESET');
    setAppliedPresetName(`${pendingPreset.name} (Đã hợp nhất)`);
    setFieldSources({
      role: 'preset',
      level: 'preset',
      techs: 'manual',
      mode: 'preset',
      language: 'preset',
    });
    setIsConflictModalOpen(false);
  };

  const handleApplyRecentConfig = (cfg: any) => {
    if (cfg.jobRoleId) setSelectedRole(cfg.jobRoleId);
    if (cfg.seniorityLevelId) setSelectedLevel(cfg.seniorityLevelId);
    if (cfg.technologyIds && Array.isArray(cfg.technologyIds)) setSelectedTechs(cfg.technologyIds);
    if (cfg.sessionMode) setSessionMode(cfg.sessionMode);
    if (cfg.competencyArea) setCompetencyArea(cfg.competencyArea);
    if (cfg.language) setInterviewLanguage(cfg.language);
    if (cfg.totalTurns) setTotalTurns(cfg.totalTurns);
    if (cfg.blueprintId) setActiveBlueprint({ id: cfg.blueprintId } as any);

    setPresetId(undefined);
    setConfigurationSource('RECENT');
    setAppliedPresetName('Cấu hình gần đây');
    setFieldSources({
      role: 'preset',
      level: 'preset',
      techs: 'preset',
      mode: 'preset',
      language: 'preset',
    });
    setValidationErrors({});
    setErrorInfo(null);
  };

  const toggleTechnology = (techId: string) => {
    setValidationErrors(prev => ({ ...prev, techs: undefined }));
    setFieldSources(prev => ({ ...prev, techs: 'manual' }));
    setSelectedTechs(prev => {
      if (prev.includes(techId)) {
        return prev.filter(id => id !== techId);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, techId];
    });
  };

  const handleModeChange = (mode: SessionMode) => {
    setSessionMode(mode);
    setFieldSources(prev => ({ ...prev, mode: 'manual' }));
    if (mode === SessionMode.STANDARD) {
      setTotalTurns(5);
    } else if (mode === SessionMode.QUICK_PRACTICE || mode === SessionMode.FOCUSED_REMEDIATION) {
      setTotalTurns(3);
    }
  };

  const validateForm = () => {
    let isValid = true;
    const errors: { role?: string; level?: string; techs?: string } = {};

    if (!selectedRole) {
      errors.role =
        language === 'vi' ? 'Vui lòng chọn vị trí công việc.' : 'Please select a target job role.';
      isValid = false;
    }
    if (!selectedLevel) {
      errors.level =
        language === 'vi'
          ? 'Vui lòng chọn cấp bậc kinh nghiệm.'
          : 'Please select a seniority level.';
      isValid = false;
    }
    if (selectedTechs.length === 0) {
      errors.techs =
        language === 'vi'
          ? 'Vui lòng chọn ít nhất 1 công nghệ cốt lõi (tối đa 5).'
          : 'Please select at least 1 technology (up to 5).';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const formatInterviewError = (err: any): { message: string; isQuotaExceeded?: boolean } => {
    const isQuota =
      err?.status === 403 ||
      err?.code === ErrorCode.QUOTA_EXCEEDED ||
      err?.code === 'QUOTA_EXCEEDED' ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'));

    if (isQuota) {
      return {
        message:
          language === 'vi'
            ? 'Bạn đã dùng hết giới hạn số lượt phỏng vấn miễn phí trong tháng (3/3 phiên). Vui lòng nâng cấp gói cước để tiếp tục luyện tập không giới hạn.'
            : 'You have reached your monthly interview quota limit (3/3 sessions). Please upgrade your plan for unlimited practice sessions.',
        isQuotaExceeded: true,
      };
    }

    return {
      message:
        err?.message ||
        (language === 'vi'
          ? 'Không thể khởi tạo phiên phỏng vấn. Vui lòng thử lại.'
          : 'Failed to initialize interview session. Please try again.'),
      isQuotaExceeded: false,
    };
  };

  const handleStartInterview = async () => {
    if (isSubmitting) return;

    if (!validateForm()) {
      setErrorInfo({
        message:
          language === 'vi'
            ? 'Vui lòng hoàn tất các thông tin bắt buộc trước khi bắt đầu.'
            : 'Please complete all required fields before starting.',
        isQuotaExceeded: false,
      });
      return;
    }

    setErrorInfo(null);
    setIsSubmitting(true);

    const idempotencyKey = `create-interview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    try {
      const session = await apiClient('/interviews', {
        method: 'POST',
        idempotencyKey,
        body: JSON.stringify({
          jobRoleId: selectedRole,
          seniorityLevelId: selectedLevel,
          technologyIds: selectedTechs,
          sessionMode,
          competencyArea:
            sessionMode === SessionMode.FOCUSED_REMEDIATION ? competencyArea : undefined,
          language: interviewLanguage,
          totalTurns: sessionMode === SessionMode.STANDARD ? 5 : totalTurns,
          isSandbox: sessionMode === SessionMode.QUICK_PRACTICE,
          presetId,
          configurationSource,
          fieldSources,
        }),
      });

      // Navigate exactly once upon success
      navigate(`/interviews/${session.id}`);
    } catch (err: any) {
      setErrorInfo(formatInterviewError(err));
      setIsSubmitting(false);
    }
  };

  const filteredTechnologies = technologies.filter(tech => {
    const matchesSearch =
      !techSearchQuery ||
      tech.name.toLowerCase().includes(techSearchQuery.toLowerCase()) ||
      tech.slug.toLowerCase().includes(techSearchQuery.toLowerCase());
    const matchesCategory =
      selectedTechCategory === 'ALL' ||
      (selectedTechCategory === 'Database' &&
        (tech.category === 'Database' || tech.category === 'Cache')) ||
      (selectedTechCategory === 'DevOps' &&
        (tech.category === 'DevOps' || tech.category === 'Cloud')) ||
      (selectedTechCategory === 'AI/Data' &&
        (tech.category === 'AI' || tech.category === 'Data')) ||
      tech.category === selectedTechCategory;
    return matchesSearch && matchesCategory;
  });

  const currentRoleObj = roles.find(r => r.id === selectedRole);
  const currentLevelObj = levels.find(l => l.id === selectedLevel);
  const selectedTechObjects = technologies.filter(t => selectedTechs.includes(t.id));

  if (loadingRoles || loadingLevels || loadingTechs) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-pulse p-4">
        <Skeleton variant="rectangular" height={90} className="rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <Skeleton variant="card" height={220} />
            <Skeleton variant="card" height={240} />
          </div>
          <div className="lg:col-span-4">
            <Skeleton variant="card" height={360} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {language === 'vi' ? 'Thiết lập Phiên Luyện tập CV-First' : 'Adaptive Practice Setup'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {language === 'vi' ? 'Cấu Hình Phỏng Vấn' : 'Configure Your Interview'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {language === 'vi'
              ? 'Tải CV để AI đề xuất, hoặc dùng lại Preset cấu hình đã lưu chỉ với một click.'
              : 'Upload CV for AI suggestions or reuse saved presets with one click.'}
          </p>
        </div>

        {upgradeSuggestion.hasHigherPlan && (
          <Link
            to={`/pricing?plan=${upgradeSuggestion.targetPlanSlug}`}
            className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-950 bg-gradient-to-r from-amber-100 via-amber-50 to-emerald-50 border border-amber-300/80 hover:border-amber-400 hover:shadow-xs transition-all active:scale-[0.98] group"
          >
            <Crown className="w-4 h-4 text-amber-600 group-hover:scale-110 group-hover:rotate-6 transition-transform" />
            <div className="text-left">
              <span className="block text-[10px] text-amber-700 font-semibold leading-none">
                {language === 'vi' ? 'Mở khóa toàn bộ quyền lợi' : 'Unlock Full Access'}
              </span>
              <span className="text-xs font-extrabold">{upgradeSuggestion.buttonLabel}</span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
          </Link>
        )}
      </div>

      {errorInfo && (
        <Alert
          variant={errorInfo.isQuotaExceeded ? 'warning' : 'error'}
          title={
            errorInfo.isQuotaExceeded
              ? language === 'vi'
                ? 'Đã đạt giới hạn hạn mức (Monthly Quota Exceeded)'
                : 'Monthly Interview Quota Reached'
              : undefined
          }
          className="animate-fade-in"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
            <span>{errorInfo.message}</span>
            {errorInfo.isQuotaExceeded ? (
              <Link to="/pricing" className="shrink-0">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                  <Zap className="h-3.5 w-3.5 mr-1" />
                  <span>{language === 'vi' ? 'Xem bảng giá nâng cấp' : 'Upgrade Plan'}</span>
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartInterview}
                leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                className="text-xs text-rose-800 hover:bg-rose-100 shrink-0"
              >
                {language === 'vi' ? 'Thử lại' : 'Retry'}
              </Button>
            )}
          </div>
        </Alert>
      )}

      {/* ROW 1: BƯỚC 1 (CV/JD) & BƯỚC 2 (PRESETS & RECENT) TRÊN CÙNG MỘT HÀNG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch mb-2">
        <div className="flex flex-col h-full">
          <CvHeroSection
            extractedProfile={extractedCvProfile}
            isParsing={isParsingCv}
            onUploadCvFile={handleUploadCvFile}
            onOpenJdInput={() => setIsJdModalOpen(true)}
            onSelectExistingProfile={() => setIsExistingProfilesModalOpen(true)}
            onSkipCv={() => {
              setExtractedCvProfile(null);
              const step3El = document.getElementById('step-3-config');
              step3El?.scrollIntoView({ behavior: 'smooth' });
            }}
            onResetCv={handleResetCv}
            onViewDetails={() => setIsTailoredExpanded(!isTailoredExpanded)}
            onProceedToPresets={() => {
              const step2El = document.getElementById('step-2-presets');
              step2El?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>

        <div id="step-2-presets" className="flex flex-col h-full">
          <SavedConfigurationsSection
            currentConfig={{
              jobRoleId: selectedRole,
              seniorityLevelId: selectedLevel,
              technologyIds: selectedTechs,
              sessionMode,
              competencyArea:
                sessionMode === SessionMode.FOCUSED_REMEDIATION ? competencyArea : undefined,
              language: interviewLanguage,
              totalTurns: sessionMode === SessionMode.STANDARD ? 5 : totalTurns,
              isSandbox: sessionMode === SessionMode.QUICK_PRACTICE,
              blueprintId: activeBlueprint?.id,
            }}
            onApplyConfig={handleApplyRecentConfig}
            onSelectPreset={handleSelectPreset}
          />
        </div>
      </div>

      {appliedPresetName && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300 animate-fade-in mb-4">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>
              Đang áp dụng cấu hình từ: <strong>"{appliedPresetName}"</strong>. Bạn có thể chỉnh sửa
              các trường bên dưới trước khi bắt đầu.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setAppliedPresetName(undefined);
              setPresetId(undefined);
              setConfigurationSource('MANUAL');
            }}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-medium underline dark:text-emerald-300 dark:hover:text-emerald-100"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* TWO-COLUMN DESKTOP LAYOUT (Steps 3 & 4 + Sticky Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Details (8 Cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* STEP 3: Technical Goal Specification */}
          <div id="step-3-config" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                Bước 3
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'vi' ? 'Vị Trí, Cấp Bậc & Kỹ Năng' : 'Role, Level & Stack'}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Role Selection */}
              <Card className={validationErrors.role ? 'border-rose-400' : 'border-slate-200'}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-emerald-600" />
                      <CardTitle className="text-sm font-bold">
                        {language === 'vi' ? 'Vị Trí Công Việc' : 'Target Job Role'}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {roles.map(role => {
                    const isSelected = selectedRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setSelectedRole(role.id);
                          setFieldSources(prev => ({ ...prev, role: 'manual' }));
                          setValidationErrors(prev => ({ ...prev, role: undefined }));
                        }}
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <h4 className="font-semibold text-xs text-slate-900">{role.name}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {role.description}
                          </p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                  {validationErrors.role && (
                    <p className="text-xs text-rose-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>{validationErrors.role}</span>
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Level Selection */}
              <Card className={validationErrors.level ? 'border-rose-400' : 'border-slate-200'}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      <CardTitle className="text-sm font-bold">
                        {language === 'vi' ? 'Cấp Bậc Kinh Nghiệm' : 'Seniority Level'}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {levels.map(level => {
                    const isSelected = selectedLevel === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => {
                          setSelectedLevel(level.id);
                          setFieldSources(prev => ({ ...prev, level: 'manual' }));
                          setValidationErrors(prev => ({ ...prev, level: undefined }));
                        }}
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <h4 className="font-semibold text-xs text-slate-900">{level.name}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {level.description}
                          </p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                  {validationErrors.level && (
                    <p className="text-xs text-rose-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>{validationErrors.level}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Technology Selection */}
            <Card className={validationErrors.techs ? 'border-rose-400' : 'border-slate-200'}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-sm font-bold">
                      {language === 'vi'
                        ? 'Công Nghệ Cốt Lõi (1 đến 5)'
                        : 'Core Technologies (1 to 5)'}
                    </CardTitle>
                  </div>
                  <Badge
                    variant={selectedTechs.length > 0 ? 'success' : 'default'}
                    className="text-xs"
                  >
                    {selectedTechs.length}/5 {language === 'vi' ? 'Đã chọn' : 'Selected'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Search & Category Filter */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={techSearchQuery}
                      onChange={e => setTechSearchQuery(e.target.value)}
                      placeholder={
                        language === 'vi'
                          ? 'Tìm nhanh công nghệ (ví dụ: Python, Docker, React, Kafka, Go...)'
                          : 'Search tech stack (e.g. Python, Docker, React, Kafka, Go...)'
                      }
                      className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                    {techSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTechSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {TECH_CATEGORIES.map(cat => {
                      const isCatActive = selectedTechCategory === cat.key;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setSelectedTechCategory(cat.key)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                            isCatActive
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {language === 'vi' ? cat.labelVi : cat.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filtered Technology Buttons */}
                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto pr-1">
                  {filteredTechnologies.map(tech => {
                    const isSelected = selectedTechs.includes(tech.id);
                    return (
                      <button
                        key={tech.id}
                        type="button"
                        onClick={() => toggleTechnology(tech.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        <span>{tech.name}</span>
                        {tech.category && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-normal ${
                              isSelected
                                ? 'bg-emerald-700 text-emerald-100'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {tech.category}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {validationErrors.techs && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 mt-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{validationErrors.techs}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* STEP 4: Practice Configuration */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                Bước 4
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'vi' ? 'Chế Độ Luyện Tập & Tùy Chọn' : 'Practice Modes & Options'}
              </h2>
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-sm font-bold">{t.practice.modeLabel}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Standard Mode */}
                  <button
                    type="button"
                    onClick={() => handleModeChange(SessionMode.STANDARD)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      sessionMode === SessionMode.STANDARD
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <GraduationCap className="h-4 w-4 text-emerald-600" />
                        <span>{t.practice.standard}</span>
                      </div>
                      <Badge variant="success" className="text-[10px]">
                        {language === 'vi' ? 'Khuyên dùng' : 'Recommended'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {language === 'vi'
                        ? '5 câu hỏi thích ứng kiểm tra toàn diện'
                        : '5-turn full adaptive interview'}
                    </p>
                  </button>

                  {/* Focused Remediation Mode */}
                  <button
                    type="button"
                    onClick={() => handleModeChange(SessionMode.FOCUSED_REMEDIATION)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      sessionMode === SessionMode.FOCUSED_REMEDIATION
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Target className="h-4 w-4 text-emerald-600" />
                      <span>{t.practice.remediation || 'Luyện tập Trọng tâm'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {language === 'vi'
                        ? 'Bài luyện tập chuyên sâu nhắm thẳng vào các điểm thiếu sót'
                        : 'Targeted drills focused on specific skill gaps'}
                    </p>
                  </button>

                  {/* Live Coding Mode */}
                  <button
                    type="button"
                    onClick={() => handleModeChange(SessionMode.CODING)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      sessionMode === SessionMode.CODING
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Code className="h-4 w-4 text-sky-600" />
                      <span>Live Coding Sandbox</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {language === 'vi'
                        ? 'Trình soạn thảo mã, thực thi và phân tích độ phức tạp'
                        : 'In-browser sandbox & complexity analysis'}
                    </p>
                  </button>

                  {/* System Design Whiteboard */}
                  <button
                    type="button"
                    onClick={() => handleModeChange(SessionMode.SYSTEM_DESIGN)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      sessionMode === SessionMode.SYSTEM_DESIGN
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Layers className="h-4 w-4 text-amber-600" />
                      <span>System Design</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {language === 'vi'
                        ? 'Vẽ sơ đồ kiến trúc bảng trắng và AI chấm điểm'
                        : 'Interactive architecture whiteboard'}
                    </p>
                  </button>

                  {/* STAR Behavioral */}
                  <button
                    type="button"
                    onClick={() => handleModeChange(SessionMode.BEHAVIORAL)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      sessionMode === SessionMode.BEHAVIORAL
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Briefcase className="h-4 w-4 text-purple-600" />
                      <span>STAR Behavioral</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {language === 'vi'
                        ? 'Đánh giá kỹ năng mềm và hành vi chuẩn STAR'
                        : 'STAR behavioral scenario evaluation'}
                    </p>
                  </button>

                  {/* Live Voice */}
                  <button
                    type="button"
                    onClick={() => handleModeChange(SessionMode.VOICE_LIVE)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      sessionMode === SessionMode.VOICE_LIVE
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Mic className="h-4 w-4 text-rose-600" />
                      <span>Voice AI Live</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {language === 'vi'
                        ? 'Giao tiếp giọng nói hai chiều trực tiếp với AI'
                        : 'Full-duplex real-time voice interview'}
                    </p>
                  </button>

                  {/* Quick Sandbox */}
                  <button
                    type="button"
                    onClick={() => handleModeChange(SessionMode.QUICK_PRACTICE)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      sessionMode === SessionMode.QUICK_PRACTICE
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <FlaskConical className="h-4 w-4 text-teal-600" />
                      <span>{t.practice.sandbox}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {language === 'vi'
                        ? '3 câu hỏi thử nghiệm không ảnh hưởng xếp hạng'
                        : '3-turn unranked practice session'}
                    </p>
                  </button>
                </div>

                {/* Focused Remediation Competency Area Picker */}
                {sessionMode === SessionMode.FOCUSED_REMEDIATION && (
                  <div className="pt-4 border-t border-slate-100 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-xs font-bold text-slate-900">
                        {t.practice.targetCompetency || 'Năng lực Kỹ thuật Trọng tâm'}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {COMPETENCY_OPTIONS.map(opt => {
                        const isSelected = competencyArea === opt.area;
                        return (
                          <button
                            key={opt.area}
                            type="button"
                            onClick={() => setCompetencyArea(opt.area)}
                            className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {language === 'vi' ? opt.label : opt.labelEn}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Language & Turns Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {language === 'vi' ? 'Ngôn ngữ Phỏng vấn' : 'Interview Language'}
                    </label>
                    <select
                      value={interviewLanguage}
                      onChange={e => {
                        setInterviewLanguage(e.target.value);
                        setFieldSources(prev => ({ ...prev, language: 'manual' }));
                      }}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="vi">Tiếng Việt (Vietnamese)</option>
                      <option value="en">English (Toàn cầu)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {language === 'vi' ? 'Số lượng Câu hỏi' : 'Question Turns'}
                    </label>
                    <div className="flex items-center gap-2">
                      {[3, 5].map(turns => (
                        <button
                          key={turns}
                          type="button"
                          onClick={() => setTotalTurns(turns)}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                            totalTurns === turns
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {turns} {language === 'vi' ? 'câu hỏi' : 'questions'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Sticky Summary (4 Cols) */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 self-start z-10">
          <StickySetupSummary
            selectedRole={currentRoleObj}
            selectedLevel={currentLevelObj}
            selectedTechObjects={selectedTechObjects}
            sessionMode={sessionMode}
            competencyArea={competencyArea}
            interviewLanguage={interviewLanguage}
            totalTurns={sessionMode === SessionMode.STANDARD ? 5 : totalTurns}
            fieldSources={fieldSources}
            activePresetName={appliedPresetName}
            hasCvProfile={!!extractedCvProfile}
            isSubmitting={isSubmitting}
            validationErrors={validationErrors}
            onStartInterview={handleStartInterview}
          />
        </div>
      </div>

      {/* Preset Conflict Resolution Modal */}
      <PresetConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        presetName={pendingPreset?.name || 'Preset'}
        diffs={conflictDiffs}
        onUseCv={handleConflictUseCv}
        onApplyPreset={handleConflictApplyPreset}
        onSmartMerge={handleConflictSmartMerge}
      />

      {/* JD Input Modal */}
      <JdInputModal
        isOpen={isJdModalOpen}
        onClose={() => setIsJdModalOpen(false)}
        onAnalyzeJd={handleAnalyzeJd}
        isAnalyzing={isAnalyzingJd}
      />

      {/* Existing Profiles Modal */}
      <ExistingProfilesModal
        isOpen={isExistingProfilesModalOpen}
        onClose={() => setIsExistingProfilesModalOpen(false)}
        profiles={profiles || []}
        isLoading={isLoadingProfiles}
        onSelectProfile={handleSelectExistingProfile}
        onUploadNew={() => {
          setIsExistingProfilesModalOpen(false);
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          fileInput?.click();
        }}
      />
    </div>
  );
}

export default SetupInterviewPage;
