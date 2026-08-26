import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { PublicPortfolioDto, BadgeProgressItemDto, CompetencyArea } from '@ai-interview/contracts';
import { BadgeGrid } from './components/BadgeGrid';
import {
  Globe,
  Lock,
  User,
  Award,
  ShieldCheck,
  ExternalLink,
  Save,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Alert } from '../../components/ui/Alert';

export const PortfolioSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    customBio: '',
    isPublic: false,
    showRealName: true,
    showBio: true,
    showSkills: true,
    showBadges: true,
    showCertificates: true,
    showHistory: false,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch current settings
  const { data: settings } = useQuery<PublicPortfolioDto>({
    queryKey: ['portfolio-settings'],
    queryFn: async () => {
      const res = await apiClient.get<PublicPortfolioDto>('/portfolio/settings');
      return res.data;
    },
  });

  // 2. Fetch user badge progress
  const { data: badges, isLoading: isLoadingBadges } = useQuery<BadgeProgressItemDto[]>({
    queryKey: ['profile-badges'],
    queryFn: async () => {
      const res = await apiClient.get<BadgeProgressItemDto[]>('/profile/badges');
      return res.data;
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        username: settings.username || '',
        displayName: settings.displayName || '',
        customBio: settings.customBio || '',
        isPublic: settings.isPublic ?? false,
        showRealName: settings.showRealName ?? true,
        showBio: settings.showBio ?? true,
        showSkills: settings.showSkills ?? true,
        showBadges: settings.showBadges ?? true,
        showCertificates: settings.showCertificates ?? true,
        showHistory: settings.showHistory ?? false,
      });
    }
  }, [settings]);

  // 3. Mutation for updating settings
  const updateMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const res = await apiClient.put('/portfolio/settings', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-settings'] });
      setSaveSuccess(true);
      setErrorMessage(null);
      setTimeout(() => setSaveSuccess(false), 4000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to update settings');
    },
  });

  // 4. Generate Certificate Mutation
  const [certSuccess, setCertSuccess] = useState<string | null>(null);
  const generateCertMutation = useMutation({
    mutationFn: async (area: CompetencyArea) => {
      const res = await apiClient.post('/certificates/generate', { competencyArea: area });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-settings'] });
      queryClient.invalidateQueries({ queryKey: ['profile-badges'] });
      setCertSuccess('Verified Certificate generated successfully! View on your public portfolio.');
      setTimeout(() => setCertSuccess(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to generate certificate');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    updateMutation.mutate(formData);
  };

  const eligibleForCert =
    badges?.filter(b => b.highestLevel === 'GOLD' || b.highestLevel === 'PLATINUM') || [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" data-testid="portfolio-settings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Public Portfolio & Badge Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Customize your shareable public profile, toggle section privacy, and generate verified
            digital certificates.
          </p>
        </div>
        {formData.username && formData.isPublic && (
          <a
            href={`/u/${formData.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Globe className="h-4 w-4" /> View Live Profile <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {saveSuccess && (
        <Alert variant="success" className="flex items-center gap-2">
          <Check className="h-4 w-4" /> Settings updated successfully!
        </Alert>
      )}

      {certSuccess && (
        <Alert variant="success" className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> {certSuccess}
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="error" className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {errorMessage}
        </Alert>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-600" /> Profile Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Custom Portfolio Username
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
                  /u/
                </div>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  placeholder="john_doe"
                  className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                  required
                  data-testid="username-input"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Alphanumeric, underscores, and dashes only.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Public Display Name
              </label>
              <Input
                type="text"
                value={formData.displayName}
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g. John Doe, Senior Backend Engineer"
                data-testid="displayname-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Custom Bio & Headline
            </label>
            <Textarea
              rows={3}
              value={formData.customBio}
              onChange={e => setFormData({ ...formData, customBio: e.target.value })}
              placeholder="Tell recruiters about your background, favorite tech stacks, and career goals..."
              data-testid="bio-input"
            />
          </div>
        </div>

        {/* Visibility Toggles */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Globe className="h-5 w-5 text-emerald-600" /> Visibility & Privacy Controls
          </h2>

          <div className="divide-y divide-slate-100">
            {/* Master Public Toggle */}
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  Enable Public Portfolio
                </span>
                <span className="text-xs text-slate-500">
                  Allow anyone with your link to view your public profile
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={e => setFormData({ ...formData, isPublic: e.target.checked })}
                className="h-5 w-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                data-testid="is-public-toggle"
              />
            </div>

            {/* Show Skills */}
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  Show Competency Skills Graph
                </span>
                <span className="text-xs text-slate-500">
                  Display evaluated benchmark scores across 5 core technical areas
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.showSkills}
                onChange={e => setFormData({ ...formData, showSkills: e.target.checked })}
                className="h-5 w-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {/* Show Badges */}
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  Show Technical Badges
                </span>
                <span className="text-xs text-slate-500">
                  Display Bronze, Silver, Gold, and Platinum achievement badges
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.showBadges}
                onChange={e => setFormData({ ...formData, showBadges: e.target.checked })}
                className="h-5 w-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {/* Show Certificates */}
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  Show Verified Certificates
                </span>
                <span className="text-xs text-slate-500">
                  Display cryptographically signed digital certificates & QR links
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.showCertificates}
                onChange={e => setFormData({ ...formData, showCertificates: e.target.checked })}
                className="h-5 w-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {/* Show History */}
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  Show Completed Interview Highlights
                </span>
                <span className="text-xs text-slate-500">
                  Display recent completed mock interview results and scores
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.showHistory}
                onChange={e => setFormData({ ...formData, showHistory: e.target.checked })}
                className="h-5 w-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={updateMutation.isPending}
              className="gap-2"
              data-testid="save-settings-btn"
            >
              <Save className="h-4 w-4" />{' '}
              {updateMutation.isPending ? 'Saving...' : 'Save Portfolio Settings'}
            </Button>
          </div>
        </div>
      </form>

      {/* Badges Inventory & Certificate Generation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" /> Badge Inventory & Unlock Progress
          </h2>
          <span className="text-xs text-slate-500">
            Auto-calculated from evaluation turn benchmarks
          </span>
        </div>

        {badges && <BadgeGrid badges={badges} isLoading={isLoadingBadges} />}

        {/* Certificate Generation Action */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Digital Certificate Generator
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Candidates who attain Gold (≥8.0) or Platinum (≥9.0) badge tier can issue digitally
            signed, HMAC-SHA256 verified certificates.
          </p>

          {eligibleForCert.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span>
                Complete more interview turn evaluations and achieve a Gold Badge (score ≥ 8.0) to
                unlock verified certificates.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {eligibleForCert.map(b => (
                <div
                  key={b.competencyArea}
                  className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm font-bold text-slate-900">{b.areaName}</span>
                    <span className="text-xs text-amber-800 font-bold ml-2">
                      ({b.highestLevel} TIER - {b.currentScore.toFixed(1)}/10)
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => generateCertMutation.mutate(b.competencyArea)}
                    disabled={generateCertMutation.isPending}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Issue Certificate
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
