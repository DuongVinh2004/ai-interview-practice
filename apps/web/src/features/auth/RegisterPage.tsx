import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterDtoSchema, RegisterDto } from '@ai-interview/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Bot } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      setAuth(response.user, response.accessToken, response.refreshToken);
      navigate('/interviews/new');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to register. Please try again.');
      }
    }
  };

  return (
    <div className="max-w-md mx-auto my-12">
      <div className="text-center mb-8">
        <div className="inline-flex bg-emerald-600 text-white p-3 rounded-2xl mb-3 shadow-md">
          <Bot className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="text-sm text-slate-500 mt-1">
          Start practicing technical interviews tailored to your target role
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <Alert variant="error" className="mb-6">
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              id="fullName"
              label="Full Name"
              placeholder="Alex Johnson"
              error={errors.fullName?.message}
              {...register('fullName')}
            />

            <Input
              id="email"
              label="Email Address"
              type="email"
              placeholder="alex@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              id="password"
              label="Password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Create Account
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
