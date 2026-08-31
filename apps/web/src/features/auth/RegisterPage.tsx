import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterDtoSchema, RegisterDto } from '@ai-interview/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth.store';
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
import { Bot, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  const { t, language } = useI18nStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterDto>({
    resolver: zodResolver(RegisterDtoSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: RegisterDto) => {
    setErrorMessage(null);
    try {
      const response = await apiClient('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
      });

      setAuth(response.user, response.accessToken);
      navigate('/interviews/new');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          language === 'vi'
            ? 'Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.'
            : 'Failed to register. Please try again.',
        );
      }
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 sm:my-14 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex bg-emerald-600 text-white p-3.5 rounded-2xl mb-3 shadow-md">
          <Bot className="h-8 w-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.auth.registerTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-sm mx-auto">
          {t.auth.registerSubtitle}
        </p>
      </div>

      <Card className="shadow-md border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-base sm:text-lg">{t.auth.registerTitle}</CardTitle>
          <CardDescription>
            {language === 'vi'
              ? 'Tạo tài khoản để mở khóa toàn bộ tính năng luyện phỏng vấn'
              : 'Create an account to unlock all mock interview features'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="error" className="mb-2">
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              id="fullName"
              label={t.auth.fullNameLabel}
              placeholder={t.auth.fullNamePlaceholder}
              leftIcon={<User className="h-4 w-4" />}
              error={errors.fullName?.message}
              {...register('fullName')}
            />

            <Input
              id="email"
              label={t.auth.emailLabel}
              type="email"
              placeholder={t.auth.emailPlaceholder}
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <div>
              <Input
                id="password"
                label={t.auth.passwordLabel}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              {isSubmitting
                ? language === 'vi'
                  ? 'Đang tạo...'
                  : 'Creating...'
                : t.auth.signUpBtn}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs sm:text-sm text-slate-500">
              {t.auth.haveAccount}{' '}
              <Link
                to="/login"
                className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                {t.auth.loginLink}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RegisterPage;
