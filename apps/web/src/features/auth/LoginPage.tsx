import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginDtoSchema, LoginDto } from '@ai-interview/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth.store';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Bot, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  const { t } = useI18nStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // MFA Challenge State
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaSessionToken, setMfaSessionToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(LoginDtoSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginDto) => {
    setErrorMessage(null);
    try {
      const response = await apiClient('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
      });

      if (response.mfaRequired && response.mfaSessionToken) {
        setMfaRequired(true);
        setMfaSessionToken(response.mfaSessionToken);
        return;
      }

      setAuth(response.user, response.accessToken, response.refreshToken);
      navigate('/');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to sign in. Please check your credentials.');
      }
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaSessionToken || !mfaCode.trim()) return;

    setIsVerifyingMfa(true);
    setErrorMessage(null);

    try {
      const endpoint = useRecoveryCode ? '/auth/mfa/recovery-verify' : '/auth/mfa/verify';
      const payload = useRecoveryCode
        ? { mfaSessionToken, recoveryCode: mfaCode.trim().toUpperCase() }
        : { mfaSessionToken, code: mfaCode.trim() };

      const response = await apiClient(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        skipAuth: true,
      });

      setAuth(response.user, response.accessToken, response.refreshToken);
      navigate('/');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to verify MFA code. Please try again.');
      }
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  const fillDemoCandidate = () => {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passInput = document.getElementById('password') as HTMLInputElement;
    if (emailInput && passInput) {
      emailInput.value = 'candidate@example.com';
      passInput.value = 'Candidate@123456';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const fillDemoAdmin = () => {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passInput = document.getElementById('password') as HTMLInputElement;
    if (emailInput && passInput) {
      emailInput.value = 'admin@example.com';
      passInput.value = 'Admin@123456';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  return (
    <div className="max-w-md mx-auto my-12">
      <div className="text-center mb-8">
        <div className="inline-flex bg-emerald-600 text-white p-3 rounded-2xl mb-3 shadow-md">
          {mfaRequired ? <ShieldCheck className="h-8 w-8" /> : <Bot className="h-8 w-8" />}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {mfaRequired ? t.mfa.mfaPromptTitle : 'Sign in to your account'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {mfaRequired
            ? t.mfa.mfaPromptSubtitle
            : 'Practice IT technical interviews with real-time AI evaluation'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {mfaRequired ? (
              <span className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-indigo-600" />
                <span>Two-Factor Authentication</span>
              </span>
            ) : (
              'Welcome Back'
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <Alert variant="error" className="mb-6">
              {errorMessage}
            </Alert>
          )}

          {mfaRequired ? (
            /* --- MFA Challenge Step --- */
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {useRecoveryCode ? 'Backup Recovery Code' : '6-digit Authenticator Code'}
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  placeholder={
                    useRecoveryCode ? t.mfa.recoveryCodePlaceholder : t.mfa.verifyCodePlaceholder
                  }
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-base font-mono tracking-wider text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  maxLength={useRecoveryCode ? 16 : 6}
                />
              </div>

              <Button
                type="submit"
                className="w-full py-2.5 gap-2"
                disabled={isVerifyingMfa || !mfaCode.trim()}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{isVerifyingMfa ? t.mfa.verifying : t.mfa.verifyAndLogin}</span>
              </Button>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode(!useRecoveryCode);
                    setMfaCode('');
                    setErrorMessage(null);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {useRecoveryCode ? t.mfa.useTotpCode : t.mfa.useRecoveryCode}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMfaRequired(false);
                    setMfaSessionToken(null);
                    setMfaCode('');
                    setErrorMessage(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center justify-center gap-1 mt-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Back to Password Login</span>
                </button>
              </div>
            </form>
          ) : (
            /* --- Normal Login Step --- */
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  id="email"
                  label="Email Address"
                  type="email"
                  placeholder="candidate@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <Input
                  id="password"
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                  {...register('password')}
                />

                <Button type="submit" className="w-full py-2.5" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              {/* Demo Fill Helper Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Quick demo:</span>
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={fillDemoCandidate}
                    className="text-emerald-600 hover:underline font-medium"
                  >
                    Candidate
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={fillDemoAdmin}
                    className="text-purple-600 hover:underline font-medium"
                  >
                    Admin
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!mfaRequired && (
        <p className="text-center text-sm text-slate-500 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-emerald-600 font-semibold hover:underline">
            Create account
          </Link>
        </p>
      )}
    </div>
  );
}
export default LoginPage;
