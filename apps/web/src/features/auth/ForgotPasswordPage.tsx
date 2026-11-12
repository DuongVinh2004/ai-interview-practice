import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ForgotPasswordDtoSchema, ForgotPasswordDto } from '@ai-interview/contracts';
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
import { KeyRound, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export function ForgotPasswordPage() {
  const { language } = useI18nStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordDto>({
    resolver: zodResolver(ForgotPasswordDtoSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordDto) => {
    setErrorMessage(null);
    try {
      await apiClient('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
      });
      setSubmittedEmail(data.email);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          language === 'vi'
            ? 'Đã xảy ra lỗi kết nối. Vui lòng thử lại.'
            : 'Connection error. Please try again.',
        );
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-10 px-4">
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            {language === 'vi' ? 'Quên mật khẩu?' : 'Forgot your password?'}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 mt-1">
            {language === 'vi'
              ? 'Nhập địa chỉ email của bạn để nhận liên kết đặt lại mật khẩu.'
              : 'Enter your email address to receive a secure password reset link.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="error" title={language === 'vi' ? 'Lỗi' : 'Error'}>
              {errorMessage}
            </Alert>
          )}

          {submittedEmail ? (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-emerald-700">
                {language === 'vi' ? 'Gửi yêu cầu thành công!' : 'Reset link sent successfully!'}
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {language === 'vi'
                  ? `Nếu tài khoản với email ${submittedEmail} tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu vào hộp thư của bạn.`
                  : `If an account with email ${submittedEmail} exists, we have sent password reset instructions to your inbox.`}
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{language === 'vi' ? 'Quay lại đăng nhập' : 'Back to sign in'}</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label={language === 'vi' ? 'Địa chỉ Email' : 'Email Address'}
                type="email"
                placeholder="name@example.com"
                leftIcon={<Mail className="h-4 w-4" />}
                error={errors.email?.message}
                {...register('email')}
              />

              <Button
                type="submit"
                className="w-full h-11 font-bold shadow-sm"
                isLoading={isSubmitting}
              >
                {isSubmitting
                  ? language === 'vi'
                    ? 'Đang gửi...'
                    : 'Sending link...'
                  : language === 'vi'
                    ? 'Gửi liên kết đặt lại'
                    : 'Send reset link'}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{language === 'vi' ? 'Quay lại đăng nhập' : 'Back to sign in'}</span>
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ForgotPasswordPage;
