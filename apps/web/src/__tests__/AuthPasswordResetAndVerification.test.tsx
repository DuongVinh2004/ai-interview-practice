import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage';

describe('Auth Password Reset & Email Verification (Plan B — Module B2)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderWithProviders = (ui: React.ReactElement, initialEntries = ['/']) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    );
  };

  describe('ForgotPasswordPage', () => {
    it('renders email input and sends password reset request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              data: { message: 'If an account exists, reset link has been sent' },
            }),
          ),
      });

      renderWithProviders(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText('name@example.com');
      fireEvent.change(emailInput, { target: { value: 'candidate@example.com' } });

      const submitBtn = screen.getByRole('button', { name: /Gửi liên kết đặt lại|Send reset/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/forgot-password'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ email: 'candidate@example.com' }),
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/hướng dẫn đặt lại mật khẩu|instructions/i)).toBeInTheDocument();
      });
    });

    it('displays error alert on server failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              message: 'Email service unavailable',
              code: 'INTERNAL_SERVER_ERROR',
            }),
          ),
      });

      renderWithProviders(<ForgotPasswordPage />);

      const emailInput = screen.getByPlaceholderText('name@example.com');
      fireEvent.change(emailInput, { target: { value: 'candidate@example.com' } });

      const submitBtn = screen.getByRole('button', { name: /Gửi liên kết đặt lại|Send reset/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Email service unavailable/i)).toBeInTheDocument();
      });
    });
  });

  describe('ResetPasswordPage', () => {
    it('warns when token is missing in URL', () => {
      renderWithProviders(
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>,
        ['/reset-password'],
      );

      expect(screen.getByText(/không hợp lệ|invalid|missing/i)).toBeInTheDocument();
    });

    it('submits new password when token is present and valid', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              data: { message: 'Password has been reset successfully' },
            }),
          ),
      });

      renderWithProviders(
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>,
        ['/reset-password?token=valid-reset-token-123'],
      );

      const passwordInput = screen.getByPlaceholderText('••••••••');
      fireEvent.change(passwordInput, { target: { value: 'StrongPassword123' } });

      const submitBtn = screen.getByRole('button', { name: /Cập nhật mật khẩu|Update password/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/reset-password'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              token: 'valid-reset-token-123',
              newPassword: 'StrongPassword123',
            }),
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/thành công|successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('VerifyEmailPage', () => {
    it('automatically verifies email when valid token is present in URL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              data: { message: 'Email has been verified successfully.' },
            }),
          ),
      });

      renderWithProviders(
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>,
        ['/verify-email?token=email-verification-token-abc'],
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/verify-email'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ token: 'email-verification-token-abc' }),
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/thành công|successfully/i)).toBeInTheDocument();
      });
    });

    it('shows error and allows requesting a new verification link if token is invalid', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/auth/verify-email')) {
          return Promise.resolve({
            ok: false,
            status: 400,
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  message: 'Token has expired',
                  code: 'INVALID_TOKEN',
                }),
              ),
          });
        }
        if (url.endsWith('/auth/resend-verification')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  data: { message: 'Verification email resent' },
                }),
              ),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      renderWithProviders(
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>,
        ['/verify-email?token=expired-token-xyz'],
      );

      await waitFor(() => {
        expect(screen.getByText(/Token has expired/i)).toBeInTheDocument();
      });

      const resendInput = screen.getByPlaceholderText('you@example.com');
      fireEvent.change(resendInput, { target: { value: 'user@example.com' } });

      const resendBtn = screen.getByRole('button', { name: /Gửi lại|Resend/i });
      fireEvent.click(resendBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/resend-verification'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ email: 'user@example.com' }),
          }),
        );
      });
    });
  });
});
