import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  JobRoleDto,
  SeniorityLevelDto,
  TechnologyDto,
  SessionMode,
  CompetencyArea,
} from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
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
} from 'lucide-react';
import { CvUploadZone } from '../../components/setup/CvUploadZone';
import { JdInputCard } from '../../components/setup/JdInputCard';
import { GapAnalysisPreview } from '../../components/setup/GapAnalysisPreview';
import { useDocumentParser } from '../../hooks/useDocumentParser';
import { InterviewBlueprintDto } from '@ai-interview/contracts';


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
  const { t } = useI18nStore();

  const [sessionMode, setSessionMode] = useState<SessionMode>(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'remediation') return SessionMode.FOCUSED_REMEDIATION;
    if (modeParam === 'sandbox') return SessionMode.QUICK_PRACTICE;
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

  // Default selection when loaded
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

  const handleStartInterview = async () => {
    if (!selectedRole || !selectedLevel || selectedTechs.length === 0) {
      setErrorMessage('Please select a role, level, and at least one technology.');
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

      navigate(`/interviews/${session.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize interview session.');
      setIsSubmitting(false);
    }
  };

  const [setupTab, setSetupTab] = useState<'standard' | 'tailored'>('standard');
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

  const handleStartBlueprintInterview = async (blueprintId: string) => {
    const roleId = selectedRole || (roles.length > 0 ? roles[0].id : '');
    const levelId = selectedLevel || (levels.length > 0 ? levels[0].id : '');
    const techIds = selectedTechs.length > 0 ? selectedTechs : (technologies.slice(0, 2).map(t => t.id));

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
      setErrorMessage(err.message || 'Failed to start tailored interview');
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

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading interview options...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configure Your Interview</h1>
          <p className="text-slate-600 mt-1">
            Choose a standard mock interview, tailored CV & JD blueprint, or live voice simulation.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSetupTab('standard')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              setupTab === 'standard'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Chế độ tiêu chuẩn
          </button>
          <button
            type="button"
            onClick={() => setSetupTab('tailored')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
              setupTab === 'tailored'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>May đo theo CV & JD</span>
          </button>
        </div>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      {setupTab === 'tailored' && (
        <div className="space-y-6" data-testid="tailored-interview-section">
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
            <div className="flex justify-center p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <Button
                size="lg"
                onClick={handleCreateBlueprint}
                isLoading={isGeneratingBlueprint}
                className="shadow-md"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                <span>Tạo Kịch bản Phỏng vấn May đo (Generate Blueprint)</span>
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


      {/* Mode Switcher */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-600" />
            <CardTitle>{t.practice.modeLabel}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Standard Mode */}
            <button
              type="button"
              onClick={() => handleModeChange(SessionMode.STANDARD)}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                sessionMode === SessionMode.STANDARD
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                <GraduationCap className="h-4 w-4 text-emerald-600" />
                <span>{t.practice.standard}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Full 5-turn adaptive interview.
              </p>
            </button>

            {/* Live Coding Mode */}
            <button
              type="button"
              onClick={() => handleModeChange(SessionMode.CODING)}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                sessionMode === SessionMode.CODING
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                <Code className="h-4 w-4 text-sky-600" />
                <span>Live Coding</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                In-browser editor, sandbox execution & AI complexity analysis.
              </p>
            </button>

            {/* Behavioral STAR Mode */}
            <button
              type="button"
              onClick={() => handleModeChange(SessionMode.BEHAVIORAL)}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                sessionMode === SessionMode.BEHAVIORAL
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                <Briefcase className="h-4 w-4 text-purple-600" />
                <span>STAR Behavioral</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                STAR framework evaluation & Amazon/Google company presets.
              </p>
            </button>

            {/* Live Voice Stream Mode */}
            <button
              type="button"
              onClick={() => handleModeChange(SessionMode.VOICE_LIVE)}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                sessionMode === SessionMode.VOICE_LIVE
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                <Mic className="h-4 w-4 text-rose-600" />
                <span>Live Voice</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Full-duplex real-time voice streaming with AI interviewer.
              </p>
            </button>

            {/* Focused Remediation */}
            <button
              type="button"
              onClick={() => handleModeChange(SessionMode.FOCUSED_REMEDIATION)}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                sessionMode === SessionMode.FOCUSED_REMEDIATION
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
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
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                sessionMode === SessionMode.QUICK_PRACTICE
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                <FlaskConical className="h-4 w-4 text-amber-600" />
                <span>{t.practice.sandbox}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                {t.practice.sandboxDesc}
              </p>
            </button>
          </div>

          {/* Focused Remediation Target Competency Picker */}
          {sessionMode === SessionMode.FOCUSED_REMEDIATION && (
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                {t.practice.targetCompetency}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {COMPETENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.area}
                    type="button"
                    onClick={() => setCompetencyArea(opt.area)}
                    className={`p-3 rounded-lg border text-xs font-medium text-left transition-all flex items-center justify-between ${
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

          {/* Turn Count Selector (for Remediation & Sandbox) */}
          {sessionMode !== SessionMode.STANDARD && (
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t.practice.questionCount}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3].map(count => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Role Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-emerald-600" />
              <CardTitle>1. Select Target Job Role</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {roles.map(role => {
              const isSelected = selectedRole === role.id;
              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">{role.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Level Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600" />
              <CardTitle>2. Select Seniority Level</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {levels.map(level => {
              const isSelected = selectedLevel === level.id;
              return (
                <div
                  key={level.id}
                  onClick={() => setSelectedLevel(level.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">{level.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{level.description}</p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Technology Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-emerald-600" />
              <CardTitle>3. Select Core Technologies (1 to 5)</CardTitle>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {selectedTechs.length}/5 Selected
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5">
            {technologies.map(tech => {
              const isSelected = selectedTechs.includes(tech.id);
              return (
                <button
                  key={tech.id}
                  type="button"
                  onClick={() => toggleTechnology(tech.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                  <span>{tech.name}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Start Button */}
      <div className="flex justify-end pt-4">
        <Button
          size="lg"
          onClick={handleStartInterview}
          isLoading={isSubmitting}
          disabled={!selectedRole || !selectedLevel || selectedTechs.length === 0}
          className="gap-2 px-8 shadow-md"
        >
          <Sparkles className="h-5 w-5" />
          <span>
            {sessionMode === SessionMode.FOCUSED_REMEDIATION
              ? `Begin ${totalTurns}-Question Remediation`
              : sessionMode === SessionMode.QUICK_PRACTICE
                ? `Start Sandbox Practice (${totalTurns} Questions)`
                : 'Begin 5-Question Interview'}
          </span>
        </Button>
      </div>
    </div>
  );
}
