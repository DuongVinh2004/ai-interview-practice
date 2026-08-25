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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Bot, ShieldCheck, KeyRound, ArrowLeft, Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  const { t, language } = useI18nStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // MFA Challenge State
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaSessionToken, setMfaSessionToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
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
        setErrorMessage(
          language === 'vi'
            ? 'Đăng nhập không thành công. Vui lòng kiểm tra lại email hoặc mật khẩu.'
            : 'Failed to sign in. Please check your credentials.',
        );
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
        setErrorMessage(
          language === 'vi'
            ? 'Xác thực mã 2FA thất bại. Vui lòng thử lại.'
            : 'Failed to verify MFA code. Please try again.',
        );
      }
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  const handleQuickLogin = (email: string, pass: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', pass, { shouldValidate: true });
    onSubmit({ email, password: pass });
  };

  return (
    <div className="max-w-md mx-auto my-8 sm:my-14 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex bg-emerald-600 text-white p-3.5 rounded-2xl mb-3 shadow-md">
          {mfaRequired ? <ShieldCheck className="h-8 w-8" /> : <Bot className="h-8 w-8" />}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {mfaRequired ? 'Two-Factor Verification Required' : 'Sign in to your account'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-sm mx-auto">
          {mfaRequired
            ? 'Enter your 6-digit authenticator code or emergency backup recovery code'
            : 'Practice IT technical interviews with real-time AI evaluation'}
        </p>
      </div>

      <Card className="shadow-md border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-base sm:text-lg">
            {mfaRequired ? (
              <span className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-indigo-600" />
                <span>Two-Factor Authentication</span>
              </span>
            ) : (
              'Welcome Back'
            )}
          </CardTitle>
          <CardDescription>
            {mfaRequired
              ? 'Provide verification code to complete sign in'
              : 'Enter your credentials to access your training dashboard'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="error" className="mb-2">
              {errorMessage}
            </Alert>
          )}

          {mfaRequired ? (
            /* --- MFA Challenge Step --- */
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label htmlFor="mfa-code-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {useRecoveryCode ? 'Backup Recovery Code' : '6-digit Authenticator Code'}
                </label>
                <input
                  id="mfa-code-input"
                  type="text"
                  autoFocus
                  required
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  placeholder={
                    useRecoveryCode ? 'Recovery code (e.g. ABCD-1234)' : '6-digit code (e.g. 123456)'
                  }
                  className="w-full h-11 px-3 py-2 bg-white border border-slate-300 rounded-lg text-base font-mono tracking-widest text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  maxLength={useRecoveryCode ? 16 : 6}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-semibold"
                disabled={isVerifyingMfa || !mfaCode.trim()}
                isLoading={isVerifyingMfa}
                leftIcon={<ShieldCheck className="h-4 w-4" />}
              >
                <span>{isVerifyingMfa ? 'Verifying...' : 'Verify & Sign In'}</span>
              </Button>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode(!useRecoveryCode);
                    setMfaCode('');
                    setErrorMessage(null);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  {useRecoveryCode
                    ? 'Use 6-digit Authenticator code instead'
                    : 'Use a backup recovery code instead'}
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
                  leftIcon={<Mail className="h-4 w-4" />}
                  error={errors.email?.message}
                  {...register('email')}
                />

                <div>
                  <Input
                    id="password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    leftIcon={<Lock className="h-4 w-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-600 focus:outline-none"
                        aria-label={showPassword ? 'Hide secret' : 'Show secret'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    }
                    error={errors.password?.message}
                    {...register('password')}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 font-bold shadow-sm"
                  isLoading={isSubmitting}
                >
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              {/* Quick 1-Click Demo Logins */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>{t.auth.orDivider}</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickLogin('candidate@example.com', 'Candidate@123456')}
                    className="text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                  >
                    ⚡ Demo Candidate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickLogin('admin@example.com', 'Admin@123456')}
                    className="text-xs font-semibold text-purple-700 hover:bg-purple-50 hover:border-purple-300"
                  >
                    🛡️ Demo Admin
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!mfaRequired && (
        <p className="text-center text-xs sm:text-sm text-slate-500 mt-6">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-emerald-600 font-bold hover:text-emerald-700 hover:underline"
          >
            Create account
          </Link>
        </p>
      )}
    </div>
  );
}

export default LoginPage;
