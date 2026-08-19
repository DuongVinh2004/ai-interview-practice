import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { JobRoleDto, SeniorityLevelDto, TechnologyDto } from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { Sparkles, Check, Layers, Code, Briefcase } from 'lucide-react';

export function SetupInterviewPage() {
  const navigate = useNavigate();
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
        }),
      });

      navigate(`/interviews/${session.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize interview session.');
      setIsSubmitting(false);
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
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Configure Your Interview</h1>
        <p className="text-slate-600 mt-1">
          Customize your 5-question technical interview session. Questions adapt dynamically based
          on your answers.
        </p>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Role Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-emerald-600" />
              <CardTitle>1. Select Target Job Role</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {roles.map(role => (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                  selectedRole === role.id
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">{role.name}</h4>
                  {role.description && (
                    <p className="text-xs text-slate-500 mt-1">{role.description}</p>
                  )}
                </div>
                {selectedRole === role.id && (
                  <div className="bg-emerald-600 text-white p-1 rounded-full">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))}
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
          <CardContent className="space-y-3">
            {levels.map(level => (
              <div
                key={level.id}
                onClick={() => setSelectedLevel(level.id)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                  selectedLevel === level.id
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">{level.name}</h4>
                  {level.description && (
                    <p className="text-xs text-slate-500 mt-1">{level.description}</p>
                  )}
                </div>
                {selectedLevel === level.id && (
                  <div className="bg-emerald-600 text-white p-1 rounded-full">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))}
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
          className="gap-2 px-8"
        >
          <Sparkles className="h-5 w-5" />
          <span>Begin 5-Question Interview</span>
        </Button>
      </div>
    </div>
  );
}
