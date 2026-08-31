import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth.store';
import { useI18nStore } from '../../stores/i18n.store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import {
  User,
  Target,
  ShieldCheck,
  ShieldAlert,
  Download,
  Award,
  Sparkles,
  Save,
  KeyRound,
  Copy,
  Check,
  Lock,
} from 'lucide-react';

export function ProfilePage() {
  const { user, setUser, setAuth, logout } = useAuthStore();
  const { t } = useI18nStore();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const autoMfaSetupStarted = useRef(false);

  const [fullName, setFullName] = useState(user?.profile?.fullName || '');
  const [targetRole, setTargetRole] = useState(user?.profile?.targetRole || 'Fullstack Engineer');
  const [targetLevel, setTargetLevel] = useState(user?.profile?.targetLevel || 'Senior');
  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // 2FA State
  const [mfaSetupData, setMfaSetupData] = useState<{
    secret: string;
    otpauthUrl: string;
    accountName: string;
  } | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Fetch live profile
  const { data: profileData, isLoading: isLoadingProfile } = useQuery<any>({
    queryKey: ['user-profile'],
    queryFn: () => apiClient('/profile'),
  });

  // Fetch benchmark gap analysis
  const {
    data: benchmarkData,
    isLoading: isLoadingBenchmark,
    refetch: refetchBenchmark,
  } = useQuery<any>({
    queryKey: ['profile-benchmarks'],
    queryFn: () => apiClient('/profile/benchmarks'),
  });

  useEffect(() => {
    if (profileData) {
      setFullName(profileData.fullName || user?.profile?.fullName || '');
      setTargetRole(profileData.targetRole || user?.profile?.targetRole || 'Fullstack Engineer');
      setTargetLevel(profileData.targetLevel || user?.profile?.targetLevel || 'Senior');
      setBio(profileData.bio || user?.profile?.bio || '');
    }
  }, [profileData, user]);

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: (data: {
      fullName: string;
      targetRole: string;
      targetLevel: string;
      bio: string;
    }) =>
      apiClient('/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: updated => {
      setSuccessMsg(t.profile.savedSuccess);
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile-benchmarks'] });
      refetchBenchmark();

      if (user) {
        setUser({
          ...user,
          profile: {
            id: user.profile?.id || updated.id || 'prof-1',
            fullName: updated.fullName,
            targetRole: updated.targetRole,
            targetLevel: updated.targetLevel,
            bio: updated.bio,
          },
        });
      }
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to update profile');
      setSuccessMsg(null);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    updateMutation.mutate({ fullName, targetRole, targetLevel, bio });
  };

  // Export GDPR JSON
  const handleExportData = async () => {
    setIsExporting(true);
    setErrorMsg(null);
    try {
      const data = await apiClient('/profile/export');
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-interview-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to export candidate data');
    } finally {
      setIsExporting(false);
    }
  };

  // 2FA Handlers
  const handleStartMfaSetup = async () => {
    setErrorMsg(null);
    setIsSettingUpMfa(true);
    try {
      const data = await apiClient('/auth/mfa/setup', { method: 'POST' });
      setMfaSetupData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize MFA setup');
      setIsSettingUpMfa(false);
    }
  };

  useEffect(() => {
    const shouldStartSetup = searchParams.get('setupMfa') === '1';
    if (shouldStartSetup && !user?.mfaEnabled && !autoMfaSetupStarted.current) {
      autoMfaSetupStarted.current = true;
      void handleStartMfaSetup();
    }
  }, [searchParams, user?.mfaEnabled]);

  const handleConfirmEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaVerifyCode.trim()) return;
    setErrorMsg(null);

    try {
      const res = await apiClient('/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: mfaVerifyCode.trim() }),
      });
      if (!res.accessToken || !res.user) {
        await logout();
        setErrorMsg(
          'Two-factor authentication was enabled, but session rotation failed. Sign in again.',
        );
        return;
      }
      setAuth(res.user, res.accessToken);
      setRecoveryCodes(res.recoveryCodes);
      setMfaSetupData(null);
      setMfaVerifyCode('');
      setSuccessMsg(res.message);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to enable MFA');
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword || !disableCode) return;
    setErrorMsg(null);

    try {
      const res = await apiClient('/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      setIsDisablingMfa(false);
      setDisablePassword('');
      setDisableCode('');
      setSuccessMsg(res.message);
      if (user) {
        setUser({ ...user, mfaEnabled: false });
      }
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to disable MFA');
    }
  };

  const copyToClipboard = (text: string, type: 'key' | 'codes') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const downloadRecoveryCodesTxt = () => {
    if (!recoveryCodes) return;
    const content = `AI INTERVIEW PRACTICE - 2FA BACKUP RECOVERY CODES\nGenerated: ${new Date().toISOString()}\nAccount: ${user?.email}\n\n${recoveryCodes.join('\n')}\n\nNote: Each recovery code can only be used ONCE.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-interview-2fa-recovery-codes.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isMfaActive = user?.mfaEnabled ?? profileData?.mfaEnabled ?? false;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16" data-testid="profile-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <User className="h-6 w-6 text-emerald-600" />
          <span>{t.profile.title}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t.profile.subtitle}</p>
      </div>

      {successMsg && <Alert variant="success">{successMsg}</Alert>}
      {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Career Profile Form */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <Target className="h-4 w-4 text-emerald-600" />
                <span>{t.profile.personalInfo}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingProfile ? (
                <div className="flex justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : (
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.profile.fullName}
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        {t.profile.targetRole}
                      </label>
                      <input
                        type="text"
                        value={targetRole}
                        onChange={e => setTargetRole(e.target.value)}
                        placeholder="e.g. Backend Engineer"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        {t.profile.targetLevel}
                      </label>
                      <select
                        value={targetLevel}
                        onChange={e => setTargetLevel(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="Junior">Junior</option>
                        <option value="Middle">Middle</option>
                        <option value="Senior">Senior</option>
                        <option value="Lead">Lead / Principal</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {t.profile.bio}
                    </label>
                    <textarea
                      rows={3}
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="Summary of experience, focus areas, and interview goals..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="gap-2 text-sm"
                    >
                      <Save className="h-4 w-4" />
                      <span>{updateMutation.isPending ? t.profile.saving : t.profile.saveBtn}</span>
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Two-Factor Authentication (2FA) Security Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                  <KeyRound className="h-4 w-4 text-indigo-600" />
                  <span>{t.mfa.title}</span>
                </CardTitle>
                <p className="text-xs text-slate-500">{t.mfa.subtitle}</p>
              </div>
              <Badge variant={isMfaActive ? 'success' : 'warning'}>
                {isMfaActive ? t.mfa.statusEnabled : t.mfa.statusDisabled}
              </Badge>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {recoveryCodes ? (
                /* --- Recovery Codes Display Modal/Banner --- */
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                    <span>{t.mfa.recoveryCodesTitle}</span>
                  </div>
                  <p className="text-xs text-amber-800">{t.mfa.recoveryCodesWarning}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-3 rounded-lg border border-amber-200 font-mono text-xs text-center font-bold text-slate-800">
                    {recoveryCodes.map((code, idx) => (
                      <div key={idx} className="bg-slate-50 p-1.5 rounded border border-slate-200">
                        {code}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(recoveryCodes.join('\n'), 'codes')}
                      className="gap-1.5 text-xs"
                    >
                      {copiedCodes ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedCodes ? 'Copied!' : t.mfa.copyCodes}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadRecoveryCodesTxt}
                      className="gap-1.5 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{t.mfa.downloadCodes}</span>
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setRecoveryCodes(null)}
                      className="gap-1.5 text-xs ml-auto"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{t.mfa.codesSavedNotice}</span>
                    </Button>
                  </div>
                </div>
              ) : mfaSetupData ? (
                /* --- Active 2FA Setup Flow --- */
                <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-indigo-950">{t.mfa.setupTitle}</h4>
                    <p className="text-xs text-slate-600">{t.mfa.step1}</p>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-indigo-200 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">
                        {t.mfa.secretKey}
                      </span>
                      <code className="text-sm font-mono font-bold text-indigo-700 tracking-wider">
                        {mfaSetupData.secret}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(mfaSetupData.secret, 'key')}
                      className="text-xs gap-1"
                    >
                      {copiedKey ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>

                  <form onSubmit={handleConfirmEnableMfa} className="space-y-3 pt-2">
                    <p className="text-xs text-slate-600">{t.mfa.step2}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={mfaVerifyCode}
                        onChange={e => setMfaVerifyCode(e.target.value)}
                        placeholder={t.mfa.verifyCodePlaceholder}
                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <Button type="submit" className="gap-1.5 text-xs">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>{t.mfa.confirmEnable}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMfaSetupData(null);
                          setIsSettingUpMfa(false);
                        }}
                        className="text-xs text-slate-500"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              ) : isDisablingMfa ? (
                /* --- Active Disable 2FA Form --- */
                <form
                  onSubmit={handleDisableMfa}
                  className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3"
                >
                  <h4 className="font-semibold text-sm text-rose-900">{t.mfa.disableTitle}</h4>
                  <p className="text-xs text-rose-700">{t.mfa.disableWarning}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="password"
                      required
                      placeholder={t.mfa.currentPasswordPlaceholder}
                      value={disablePassword}
                      onChange={e => setDisablePassword(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      required
                      placeholder={t.mfa.disableCodePlaceholder}
                      value={disableCode}
                      onChange={e => setDisableCode(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button type="submit" variant="danger" size="sm" className="gap-1.5 text-xs">
                      <Lock className="h-3.5 w-3.5" />
                      <span>{t.mfa.confirmDisable}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsDisablingMfa(false)}
                      className="text-xs text-slate-500"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                /* --- Idle 2FA Action Buttons --- */
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {isMfaActive
                      ? 'Your account is secured with 2FA.'
                      : 'Add an extra layer of security to your candidate and admin actions.'}
                  </div>
                  {isMfaActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDisablingMfa(true)}
                      className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50 gap-1.5"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>{t.mfa.disableBtn}</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleStartMfaSetup}
                      disabled={isSettingUpMfa}
                      className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{t.mfa.enableBtn}</span>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Account Info & GDPR Data Export */}
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Account Credentials</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block uppercase font-medium">Email</span>
                <span className="font-semibold text-slate-800 text-sm">{user?.email}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase font-medium">Role</span>
                <Badge variant={user?.role === 'ADMIN' ? 'warning' : 'default'} className="mt-1">
                  {user?.role}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400 block uppercase font-medium">Status</span>
                <Badge variant="success" className="mt-1">
                  {user?.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* GDPR Export Card */}
          <Card className="shadow-sm border-slate-200 bg-slate-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <Download className="h-4 w-4 text-indigo-600" />
                <span>{t.profile.gdprTitle}</span>
              </CardTitle>
              <p className="text-xs text-slate-500">{t.profile.gdprSubtitle}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
                disabled={isExporting}
                className="w-full gap-2 text-xs border-indigo-200 hover:bg-indigo-50 text-indigo-700"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isExporting ? t.profile.exporting : t.profile.exportDataBtn}</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Industry Competency Benchmarks Section */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Award className="h-5 w-5 text-indigo-600" />
              <span>{t.profile.benchmarksTitle}</span>
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">{t.profile.benchmarksSubtitle}</p>
          </div>

          {benchmarkData && (
            <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-900">
                {t.profile.readinessScore}: {benchmarkData.readinessPercentage}%
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-6">
          {isLoadingBenchmark ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Spinner size="md" />
              <span className="text-xs text-slate-500">
                Analyzing session telemetry and benchmark standards...
              </span>
            </div>
          ) : benchmarkData?.benchmarks?.length ? (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-semibold text-slate-900">
                    Target Standard Level: {benchmarkData.targetLevel}
                  </span>
                  <p className="text-slate-500">
                    Calculated across {benchmarkData.evaluatedTurnsCount} evaluated interview turns.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">
                      Overall Readiness
                    </span>
                    <span className="block text-xl font-extrabold text-indigo-600">
                      {benchmarkData.readinessPercentage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Competency Gap Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {benchmarkData.benchmarks.map((item: any) => {
                  const isExceeds = item.status === 'EXCEEDS';
                  const isMeets = item.status === 'MEETS';

                  return (
                    <div
                      key={item.competency}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-900">{item.name}</span>
                        <Badge
                          variant={isExceeds ? 'success' : isMeets ? 'default' : 'warning'}
                          className="text-[10px]"
                        >
                          {isExceeds
                            ? t.profile.exceeds
                            : isMeets
                              ? t.profile.meets
                              : t.profile.needsWork}
                        </Badge>
                      </div>

                      {/* Score Comparison Bars */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Your Assessed Score:</span>
                          <span className="font-bold text-slate-800">{item.userScore}/10</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isExceeds
                                ? 'bg-emerald-500'
                                : isMeets
                                  ? 'bg-indigo-500'
                                  : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, item.userScore * 10)}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                          <span>Industry Expectation:</span>
                          <span>{item.benchmarkScore}/10</span>
                        </div>
                      </div>

                      {/* Actionable recommendation */}
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-md border border-slate-100 mt-2">
                        💡 {item.recommendation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-500">
              No interview records available yet to compute benchmark comparisons.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
export default ProfilePage;
