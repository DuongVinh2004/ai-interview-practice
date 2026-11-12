import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ResetPasswordDtoSchema, ResetPasswordDto } from '@ai-interview/contracts';
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
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { language } = useI18nStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordDto>({
    resolver: zodResolver(ResetPasswordDtoSchema),
    defaultValues: {
      token,
      newPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordDto) => {
    setErrorMessage(null);
    try {
      await apiClient('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
      });
      setIsSuccess(true);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          language === 'vi'
            ? 'Đã xảy ra lỗi khi đặt lại mật khẩu.'
            : 'An error occurred while resetting your password.',
        );
      }
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-md mx-auto py-10 px-4">
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-2">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              {language === 'vi' ? 'Thiếu mã xác thực' : 'Invalid Reset Link'}
            </CardTitle>
            <CardDescription className="text-sm text-slate-500 mt-1">
              {language === 'vi'
                ? 'Liên kết đặt lại mật khẩu không hợp lệ hoặc thiếu mã token.'
                : 'The password reset link is missing a valid token.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-2">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              {language === 'vi' ? 'Yêu cầu liên kết mới' : 'Request a new reset link'}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-10 px-4">
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            {language === 'vi' ? 'Tạo mật khẩu mới' : 'Set New Password'}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 mt-1">
            {language === 'vi'
              ? 'Nhập mật khẩu mới mạnh mẽ để bảo vệ tài khoản của bạn.'
              : 'Enter a strong new password to protect your account.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="error" title={language === 'vi' ? 'Lỗi' : 'Error'}>
              {errorMessage}
            </Alert>
          )}

          {isSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {language === 'vi'
                  ? 'Mật khẩu của bạn đã được cập nhật thành công!'
                  : 'Your password has been successfully updated!'}
              </p>
              <div className="pt-2">
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full h-11 font-bold shadow-sm"
                >
                  {language === 'vi' ? 'Đăng nhập ngay' : 'Sign in now'}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input type="hidden" {...register('token')} value={token} />

              <Input
                label={language === 'vi' ? 'Mật khẩu mới' : 'New Password'}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                error={errors.newPassword?.message}
                {...register('newPassword')}
              />

              <Button
                type="submit"
                className="w-full h-11 font-bold shadow-sm"
                isLoading={isSubmitting}
              >
                {isSubmitting
                  ? language === 'vi'
                    ? 'Đang cập nhật...'
                    : 'Updating...'
                  : language === 'vi'
                    ? 'Cập nhật mật khẩu'
                    : 'Update password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ResetPasswordPage;
