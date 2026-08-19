import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginDtoSchema, LoginDto } from '@ai-interview/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Bot } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  return (
    <div className="max-w-md mx-auto my-12">
      <div className="text-center mb-8">
        <div className="inline-flex bg-emerald-600 text-white p-3 rounded-2xl mb-3 shadow-md">
          <Bot className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Sign in to your account</h1>
        <p className="text-sm text-slate-500 mt-1">
          Practice IT technical interviews with real-time AI evaluation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome Back</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <Alert variant="error" className="mb-6">
              {errorMessage}
            </Alert>
          )}

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

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Sign In
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
            <button
              type="button"
              onClick={fillDemoCandidate}
              className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-2 px-3 rounded-lg font-medium transition-colors text-center"
            >
              Fill Demo Candidate (candidate@example.com / Candidate@123456)
            </button>

            <p className="text-xs text-slate-500 text-center">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
