import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  JobRoleDto,
  SeniorityLevelDto,
  TechnologyDto,
  SessionMode,
  CompetencyArea,
  InterviewBlueprintDto,
} from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../../components/ui/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/Card';
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
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { CvUploadZone } from '../../components/setup/CvUploadZone';
import { JdInputCard } from '../../components/setup/JdInputCard';
import { GapAnalysisPreview } from '../../components/setup/GapAnalysisPreview';
import { useDocumentParser } from '../../hooks/useDocumentParser';

const COMPETENCY_OPTIONS = [
  { area: CompetencyArea.SYSTEM_DESIGN, label: 'System Design & Scalability' },
  { area: CompetencyArea.LANGUAGE_CORE, label: 'Core Language & Fundamentals' },
  { area: CompetencyArea.DATABASE_CONCURRENCY, label: 'Databases & Concurrency' },
  { area: CompetencyArea.ARCHITECTURE_PATTERNS, label: 'Architecture & Patterns' },
  { area: CompetencyArea.RESILIENCE_SECURITY, label: 'Resilience & Security' },
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

  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    role?: string;
    level?: string;
    techs?: string;
  }>({});

  // Progressive Disclosure for Tailored CV / JD Blueprint
  const [isTailoredExpanded, setIsTailoredExpanded] = useState(false);
  const [parsedCvProfile, setParsedCvProfile] = useState<any>(null);
  const [analyzedJd, setAnalyzedJd] = useState<any>(null);
  const [activeBlueprint, setActiveBlueprint] = useState<InterviewBlueprintDto | null>(null);

  const {
    parseCv,
    isParsingCv,
    analyzeJd,
    isAnalyzingJd,
    generateBlueprint,
    isGeneratingBlueprint,
  } = useDocumentParser();

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

  const toggleTechnology = (techId: string) => {
    setValidationErrors(prev => ({ ...prev, techs: undefined }));
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
    if (mode === SessionMode.STANDARD) {
      setTotalTurns(5);
    } else {
      setTotalTurns(3);
    }
  };

  const validateForm = (): boolean => {
    const errors: { role?: string; level?: string; techs?: string } = {};
    let isValid = true;

    if (!selectedRole) {
      errors.role =
        language === 'vi' ? 'Vui lòng chọn vị trí mục tiêu.' : 'Please select a job role.';
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

  const handleStartInterview = async () => {
    if (isSubmitting) return;

    if (!validateForm()) {
      setErrorMessage(
        language === 'vi'
          ? 'Vui lòng hoàn tất các thông tin bắt buộc trước khi bắt đầu.'
          : 'Please complete all required fields before starting.',
      );
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const session = await apiClient('/interviews', {
        method: 'POST',
        body: JSON.stringify({
          jobRoleId: selectedRole,
          seniorityLevelId: selectedLevel,
          technologyIds: selectedTechs,
          sessionMode,
          competencyArea:
            sessionMode === SessionMode.FOCUSED_REMEDIATION ? competencyArea : undefined,
          totalTurns: sessionMode === SessionMode.STANDARD ? 5 : totalTurns,
          isSandbox: sessionMode === SessionMode.QUICK_PRACTICE,
        }),
      });

      // Navigate exactly once upon success
      navigate(`/interviews/${session.id}`);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (language === 'vi'
            ? 'Không thể khởi tạo phiên phỏng vấn. Vui lòng thử lại.'
            : 'Failed to initialize interview session. Please try again.'),
      );
      setIsSubmitting(false);
    }
  };

  const handleStartBlueprintInterview = async (blueprintId: string) => {
    const roleId = selectedRole || (roles.length > 0 ? roles[0].id : '');
    const levelId = selectedLevel || (levels.length > 0 ? levels[0].id : '');
    const techIds =
      selectedTechs.length > 0 ? selectedTechs : technologies.slice(0, 2).map(t => t.id);

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const session = await apiClient('/interviews', {
        method: 'POST',
        body: JSON.stringify({
          jobRoleId: roleId,
          seniorityLevelId: levelId,
          technologyIds: techIds,
          sessionMode: SessionMode.STANDARD,
          totalTurns: 5,
          blueprintId,
        }),
      });
      navigate(`/interviews/${session.id}`);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (language === 'vi'
            ? 'Không thể bắt đầu phỏng vấn theo kịch bản may đo.'
            : 'Failed to start tailored interview.'),
      );
      setIsSubmitting(false);
    }
  };

  const handleCreateBlueprint = async () => {
    if (!parsedCvProfile?.id || !analyzedJd?.id) return;
    try {
      const bp = await generateBlueprint({
        parsedProfileId: parsedCvProfile.id,
        jdAnalysisId: analyzedJd.id,
      });
      setActiveBlueprint(bp);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate tailored blueprint');
    }
  };

  const isLoadingData = loadingRoles || loadingLevels || loadingTechs;

  const currentRoleObj = roles.find(r => r.id === selectedRole);
  const currentLevelObj = levels.find(l => l.id === selectedLevel);
  const currentTechNames = technologies.filter(t => selectedTechs.includes(t.id)).map(t => t.name);

  const estimatedMinutes = sessionMode === SessionMode.STANDARD ? 15 : totalTurns * 3;

  if (isLoadingData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton variant="rectangular" height={80} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton variant="card" height={220} />
          <Skeleton variant="card" height={220} />
        </div>
        <Skeleton variant="card" height={160} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {language === 'vi' ? 'Thiết lập Phiên Luyện tập' : 'Adaptive Practice Setup'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {language === 'vi' ? 'Cấu Hình Phỏng Vấn' : 'Configure Your Interview'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {language === 'vi'
              ? 'Chọn vị trí, cấp bậc và công nghệ để AI điều chỉnh độ khó câu hỏi thích ứng theo thời gian thực.'
              : 'Select your target role, seniority, and stack. Questions dynamically adapt based on your answer quality.'}
          </p>
        </div>
      </div>

      {errorMessage && (
        <Alert variant="error" className="animate-fade-in">
          <div className="flex items-center justify-between gap-2 w-full">
            <span>{errorMessage}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartInterview}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              className="text-xs text-rose-800 hover:bg-rose-100"
            >
              {language === 'vi' ? 'Thử lại' : 'Retry'}
            </Button>
          </div>
        </Alert>
      )}

      {/* STEP 1: Goal & Target Specification */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
            1
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {language === 'vi' ? 'Mục Tiêu Kỹ Thuật (Goal & Target)' : 'Goal & Technical Focus'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Role Selection */}
          <Card className={validationErrors.role ? 'border-rose-400' : 'border-slate-200'}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm font-bold">
                  {language === 'vi' ? 'Vị Trí Công Việc' : 'Target Job Role'}
                </CardTitle>
              </div>
              <CardDescription>
                {language === 'vi'
                  ? 'Định hình bối cảnh phỏng vấn kỹ thuật'
                  : 'Defines the interview context'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {roles.map(role => {
                const isSelected = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setSelectedRole(role.id);
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
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm font-bold">
                  {language === 'vi' ? 'Cấp Bậc Kinh Nghiệm' : 'Seniority Level'}
                </CardTitle>
              </div>
              <CardDescription>
                {language === 'vi'
                  ? 'Quyết định độ sâu và tiêu chí chấm điểm rubric'
                  : 'Sets baseline question difficulty'}
              </CardDescription>
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
                  {language === 'vi' ? 'Công Nghệ Cốt Lõi (1 đến 5)' : 'Core Technologies (1 to 5)'}
                </CardTitle>
              </div>
              <Badge variant={selectedTechs.length > 0 ? 'success' : 'default'} className="text-xs">
                {selectedTechs.length}/5 {language === 'vi' ? 'Đã chọn' : 'Selected'}
              </Badge>
            </div>
            <CardDescription>
              {language === 'vi'
                ? 'AI sẽ tạo các kịch bản thực tế dựa trên công nghệ bạn chọn'
                : 'Questions will test your practical problem-solving in these technologies'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {technologies.map(tech => {
                const isSelected = selectedTechs.includes(tech.id);
                return (
                  <button
                    key={tech.id}
                    type="button"
                    onClick={() => toggleTechnology(tech.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    <span>{tech.name}</span>
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

      {/* STEP 2: Practice Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
            2
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {language === 'vi' ? 'Cấu Hình Buổi Luyện Tập' : 'Practice Configuration'}
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
                  <span>Live Voice</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {language === 'vi'
                    ? 'Hội thoại trực tiếp bằng giọng nói 2 chiều'
                    : 'Full-duplex real-time voice streaming'}
                </p>
              </button>

              {/* Focused Remediation */}
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
                  <Target className="h-4 w-4 text-indigo-600" />
                  <span>{t.practice.remediation}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {t.practice.remediationDesc}
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
                  <FlaskConical className="h-4 w-4 text-amber-600" />
                  <span>{t.practice.sandbox}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {t.practice.sandboxDesc}
                </p>
              </button>
            </div>

            {/* Focused Remediation Area Picker */}
            {sessionMode === SessionMode.FOCUSED_REMEDIATION && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  {t.practice.targetCompetency}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COMPETENCY_OPTIONS.map(opt => (
                    <button
                      key={opt.area}
                      type="button"
                      onClick={() => setCompetencyArea(opt.area)}
                      className={`p-2.5 rounded-lg border text-xs font-medium text-left transition-all flex items-center justify-between ${
                        competencyArea === opt.area
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {competencyArea === opt.area && <Check className="h-4 w-4 text-indigo-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Turn Count Selector */}
            {sessionMode !== SessionMode.STANDARD && (
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {t.practice.questionCount}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 5].map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTotalTurns(count)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                        totalTurns === count
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {count} {count === 1 ? 'Question' : 'Questions'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progressive Disclosure: Advanced CV / JD Tailored Blueprint */}
        <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setIsTailoredExpanded(!isTailoredExpanded)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-indigo-600" />
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  {language === 'vi'
                    ? 'Tùy Chọn Nâng Cao: Kịch bản May Đo theo CV & JD'
                    : 'Advanced Option: CV & JD Tailored Blueprint'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {language === 'vi'
                    ? 'Tải lên CV hoặc mô tả công việc (JD) để tạo câu hỏi sát với hồ sơ cá nhân'
                    : 'Upload your CV or JD to synthesize specialized interview probes'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeBlueprint && (
                <Badge variant="purple" className="text-[10px]">
                  {language === 'vi' ? 'Đã tạo Blueprint' : 'Blueprint Ready'}
                </Badge>
              )}
              {isTailoredExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </div>
          </button>

          {isTailoredExpanded && (
            <div className="p-5 border-t border-slate-100 bg-slate-50/40 space-y-6 animate-slide-up">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CvUploadZone
                  isParsing={isParsingCv}
                  onParseFile={async file => {
                    const res = await parseCv({ file });
                    setParsedCvProfile(res.parsedProfile);
                    return res;
                  }}
                  onParseText={async text => {
                    const res = await parseCv({ text });
                    setParsedCvProfile(res.parsedProfile);
                    return res;
                  }}
                  onParsed={res => setParsedCvProfile(res.parsedProfile)}
                />

                <JdInputCard
                  isAnalyzing={isAnalyzingJd}
                  onAnalyzeJd={async (jdText, roleTitle) => {
                    const res = await analyzeJd({ jdText, roleTitle });
                    setAnalyzedJd(res);
                    return res;
                  }}
                  onAnalyzed={res => setAnalyzedJd(res)}
                />
              </div>

              {parsedCvProfile && analyzedJd && !activeBlueprint && (
                <div className="flex justify-center p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <Button
                    size="md"
                    onClick={handleCreateBlueprint}
                    isLoading={isGeneratingBlueprint}
                    className="shadow-sm"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span>
                      {language === 'vi' ? 'Tạo Kịch Bản Phỏng Vấn' : 'Generate Blueprint'}
                    </span>
                  </Button>
                </div>
              )}

              {activeBlueprint && (
                <GapAnalysisPreview
                  blueprint={activeBlueprint}
                  onProceed={handleStartBlueprintInterview}
                  isLoading={isSubmitting}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* STEP 3: Review & Single Primary CTA */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
            3
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {language === 'vi' ? 'Xác Nhận & Bắt Đầu' : 'Review & Launch'}
          </h2>
        </div>

        <Card className="bg-slate-900 text-white border-slate-800 shadow-lg">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">
                  {language === 'vi' ? 'Vị trí & Cấp bậc' : 'Role & Level'}
                </span>
                <span className="font-bold text-white text-sm">
                  {currentRoleObj?.name || 'Fullstack Engineer'} •{' '}
                  {currentLevelObj?.name || 'Senior'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">
                  {language === 'vi' ? 'Công nghệ trọng tâm' : 'Selected Technologies'}
                </span>
                <span className="font-semibold text-emerald-400 truncate block">
                  {currentTechNames.join(', ') ||
                    (language === 'vi' ? 'Chưa chọn' : 'None selected')}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">
                  {language === 'vi' ? 'Thời lượng ước tính' : 'Estimated Duration'}
                </span>
                <span className="font-bold text-white flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    {sessionMode === SessionMode.STANDARD ? 5 : totalTurns}{' '}
                    {language === 'vi' ? 'câu hỏi' : 'questions'} (~{estimatedMinutes} mins)
                  </span>
                </span>
              </div>
            </div>

            {/* Reassuring Practice Disclaimers */}
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  {language === 'vi'
                    ? 'Bạn sẽ trả lời các câu hỏi thích ứng theo thời gian thực. AI dùng câu trả lời của bạn để đưa ra phản hồi luyện tập theo rubric chuẩn.'
                    : 'You will answer adaptive questions in real time. AI uses your responses to produce formative rubric feedback and skill gap recommendations.'}
                </p>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-slate-400 pl-6">
                <span>•</span>
                <p>
                  {language === 'vi'
                    ? 'Kết quả chỉ nhằm mục đích luyện tập và tự học, không phải quyết định tuyển dụng chính thức.'
                    : 'All scores are strictly for practice and self-improvement, not employment hiring decisions.'}
                </p>
              </div>
            </div>

            {/* Single Dominant Primary Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="text-xs text-slate-400 text-center sm:text-left">
                {selectedTechs.length === 0
                  ? language === 'vi'
                    ? '⚠️ Hãy chọn ít nhất 1 công nghệ ở Bước 1'
                    : '⚠️ Please select at least 1 technology in Step 1'
                  : language === 'vi'
                    ? 'Sẵn sàng bắt đầu phiên luyện tập kỹ thuật'
                    : 'Ready to launch technical practice session'}
              </div>

              <Button
                size="lg"
                onClick={handleStartInterview}
                isLoading={isSubmitting}
                disabled={
                  isSubmitting || !selectedRole || !selectedLevel || selectedTechs.length === 0
                }
                leftIcon={<Play className="h-4 w-4" />}
                className="w-full sm:w-auto px-8 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-md focus-visible:ring-emerald-400"
              >
                <span>
                  {isSubmitting
                    ? language === 'vi'
                      ? 'Đang khởi tạo...'
                      : 'Initializing...'
                    : language === 'vi'
                      ? 'Bắt đầu Phỏng vấn'
                      : 'Start Practice Session'}
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SetupInterviewPage;
