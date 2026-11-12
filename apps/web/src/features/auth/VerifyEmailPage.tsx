import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiClient, ApiError } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/Card';
import { MailCheck, CheckCircle2, ArrowRight, RefreshCw, Mail } from 'lucide-react';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { language } = useI18nStore();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'idle'>(
    token ? 'verifying' : 'idle',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (!token || verifiedRef.current) return;
    verifiedRef.current = true;

    async function performVerification() {
      try {
        await apiClient('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
          skipAuth: true,
        });
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage(
            language === 'vi'
              ? 'Mã xác thực không hợp lệ hoặc đã hết hạn.'
              : 'The verification token is invalid or has expired.',
          );
        }
      }
    }

    void performVerification();
  }, [token, language]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResendLoading(true);
    setErrorMessage(null);
    try {
      await apiClient('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: resendEmail.trim() }),
        skipAuth: true,
      });
      setResendSuccess(true);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          language === 'vi'
            ? 'Đã xảy ra lỗi khi gửi lại email xác thực.'
            : 'Failed to resend verification email.',
        );
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-10 px-4">
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
            <MailCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            {language === 'vi' ? 'Xác thực Email' : 'Email Verification'}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 mt-1">
            {language === 'vi'
              ? 'Xác nhận quyền sở hữu địa chỉ email tài khoản của bạn.'
              : 'Confirm your email address ownership for your account.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'verifying' && (
            <div className="text-center py-6 space-y-3">
              <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-sm text-slate-600">
                {language === 'vi'
                  ? 'Đang kiểm tra và xác thực email của bạn...'
                  : 'Verifying your email address...'}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {language === 'vi'
                  ? 'Địa chỉ email của bạn đã được xác thực thành công!'
                  : 'Your email address has been successfully verified!'}
              </p>
              <div className="pt-2">
                <Link to="/login">
                  <Button className="w-full h-11 font-bold shadow-sm">
                    <span>{language === 'vi' ? 'Đăng nhập ngay' : 'Sign in now'}</span>
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {(status === 'error' || status === 'idle') && (
            <div className="space-y-4">
              {status === 'error' && (
                <Alert variant="error" title={language === 'vi' ? 'Lỗi' : 'Error'}>
                  {errorMessage ||
                    (language === 'vi'
                      ? 'Liên kết xác thực không hợp lệ hoặc đã hết hạn.'
                      : 'The verification link is invalid or expired.')}
                </Alert>
              )}

              {resendSuccess ? (
                <div className="text-center py-4 space-y-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
                  <p className="text-sm text-slate-700">
                    {language === 'vi'
                      ? 'Liên kết xác thực mới đã được gửi vào hộp thư của bạn.'
                      : 'A new verification link has been sent to your email.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleResend} className="space-y-3">
                  <p className="text-xs text-slate-500">
                    {language === 'vi'
                      ? 'Nhập email để nhận liên kết xác thực mới:'
                      : 'Enter your email to receive a new verification link:'}
                  </p>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    leftIcon={<Mail className="h-4 w-4" />}
                    value={resendEmail}
                    onChange={e => setResendEmail(e.target.value)}
                    required
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full h-10 text-xs font-semibold"
                    isLoading={resendLoading}
                  >
                    {language === 'vi' ? 'Gửi lại email xác thực' : 'Resend verification email'}
                  </Button>
                </form>
              )}

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  {language === 'vi' ? 'Quay lại đăng nhập' : 'Back to sign in'}
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default VerifyEmailPage;
