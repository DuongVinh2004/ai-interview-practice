import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../features/auth/LoginPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { useAuthStore } from '../stores/auth.store';
import { UserRole, UserStatus } from '@ai-interview/contracts';

describe('Epic 8 Two-Factor Authentication (2FA & Recovery Codes)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useAuthStore.getState().logout();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      // Login returning MFA Challenge
      if (url.endsWith('/auth/login')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  mfaRequired: true,
                  mfaSessionToken: 'mock-mfa-session-token',
                  expiresIn: 300,
                },
              }),
            ),
        });
      }

      // Verify MFA TOTP code
      if (url.endsWith('/auth/mfa/verify')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  user: {
                    id: 'user-admin-1',
                    email: 'admin@example.com',
                    role: UserRole.ADMIN,
                    status: UserStatus.ACTIVE,
                    mfaEnabled: true,
                  },
                  accessToken: 'mock-access-token',
                  refreshToken: 'mock-refresh-token',
                  expiresIn: 900,
                },
              }),
            ),
        });
      }

      // Verify MFA Recovery code
      if (url.endsWith('/auth/mfa/recovery-verify')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  user: {
                    id: 'user-admin-1',
                    email: 'admin@example.com',
                    role: UserRole.ADMIN,
                    status: UserStatus.ACTIVE,
                    mfaEnabled: true,
                  },
                  accessToken: 'mock-access-token',
                  refreshToken: 'mock-refresh-token',
                  expiresIn: 900,
                },
              }),
            ),
        });
      }

      // MFA Setup
      if (url.endsWith('/auth/mfa/setup')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  secret: 'JBSWY3DPEHPK3PXP',
                  otpauthUrl:
                    'otpauth://totp/AI%20Interview:test@example.com?secret=JBSWY3DPEHPK3PXP',
                  issuer: 'AI Interview Practice',
                  accountName: 'test@example.com',
                },
              }),
            ),
        });
      }

      // MFA Enable
      if (url.endsWith('/auth/mfa/enable')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  success: true,
                  mfaEnabled: true,
                  recoveryCodes: [
                    'A1B2-C3D4-E5',
                    'F6G7-H8J9-K0',
                    'L1M2-N3P4-Q5',
                    'R6S7-T8U9-V0',
                    'W1X2-Y3Z4-A5',
                    'B6C7-D8E9-F0',
                    'G1H2-J3K4-L5',
                    'M6N7-P8Q9-R0',
                  ],
                  message: '2FA enabled successfully',
                },
              }),
            ),
        });
      }

      // Profile endpoints
      if (url.endsWith('/profile')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  id: 'prof-1',
                  userId: 'user-1',
                  fullName: 'Alex Nguyen',
                  targetRole: 'Senior Backend Engineer',
                  targetLevel: 'Senior',
                  mfaEnabled: false,
                },
              }),
            ),
        });
      }

      if (url.endsWith('/profile/benchmarks')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  benchmarks: [],
                  readinessPercentage: 85,
                },
              }),
            ),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ data: {} })),
      });
    });
  });

  it('handles 2-step login challenge and verifies TOTP code', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div>Dashboard Home</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Enter email & password
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Admin@123456' },
    });

    // Submit password login
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    // Expect 2FA Challenge step to appear
    await waitFor(() => {
      expect(
        screen.getByText(/Two-Factor Verification Required|Yêu cầu Xác thực 2 Yếu tố/i),
      ).toBeInTheDocument();
    });

    // Enter 6-digit TOTP code
    const totpInput = screen.getByPlaceholderText(/6-digit code|Mã 6 chữ số/i);
    fireEvent.change(totpInput, { target: { value: '123456' } });

    // Submit MFA verification
    fireEvent.click(screen.getByRole('button', { name: /Verify & Sign In|Xác thực & Đăng nhập/i }));

    // Verify authenticated state
    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.email).toBe('admin@example.com');
    });
  });

  it('redirects an admin without MFA to enrollment instead of showing the verification form', async () => {
    const defaultFetch = global.fetch as ReturnType<typeof vi.fn>;
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith('/auth/login')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  user: {
                    id: 'user-admin-1',
                    email: 'admin@example.com',
                    role: UserRole.ADMIN,
                    status: UserStatus.ACTIVE,
                    mfaEnabled: false,
                  },
                  accessToken: 'restricted-admin-access-token',
                  refreshToken: 'admin-refresh-token',
                  forceMfaSetup: true,
                },
              }),
            ),
        });
      }
      return defaultFetch(url, options);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Admin@123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/mfa/setup'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(screen.queryByText(/Two-Factor Verification Required/i)).not.toBeInTheDocument();
  });

  it('allows switching to recovery code input on 2-step login', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Login with password
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Admin@123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Two-Factor Verification Required|Yêu cầu Xác thực 2 Yếu tố/i),
      ).toBeInTheDocument();
    });

    // Switch to recovery code mode
    const recoveryBtn = screen.getByText(
      /Use a backup recovery code instead|Sử dụng Mã khôi phục dự phòng/i,
    );
    fireEvent.click(recoveryBtn);

    // Expect recovery code input
    expect(screen.getByPlaceholderText(/Recovery code|Mã khôi phục/i)).toBeInTheDocument();

    // Fill recovery code
    const recoveryInput = screen.getByPlaceholderText(/Recovery code|Mã khôi phục/i);
    fireEvent.change(recoveryInput, { target: { value: 'A1B2-C3D4-E5' } });

    // Submit recovery code
    fireEvent.click(screen.getByRole('button', { name: /Verify & Sign In|Xác thực & Đăng nhập/i }));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  it('allows candidate to initialize and enable 2FA in ProfilePage, displaying 8 recovery codes', async () => {
    useAuthStore.getState().setUser({
      id: 'user-1',
      email: 'alex@example.com',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
      createdAt: '2026-08-01T00:00:00Z',
      profile: {
        id: 'prof-1',
        fullName: 'Alex Nguyen',
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Enable 2FA|Bật Xác thực 2FA/i }),
      ).toBeInTheDocument();
    });

    // Click Enable 2FA
    fireEvent.click(screen.getByRole('button', { name: /Enable 2FA|Bật Xác thực 2FA/i }));

    // Secret Key should be displayed
    await waitFor(() => {
      expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    });

    // Enter 6-digit confirmation code
    const codeInput = screen.getByPlaceholderText(/6-digit code|Mã 6 chữ số/i);
    fireEvent.change(codeInput, { target: { value: '654321' } });

    // Confirm activation
    fireEvent.click(
      screen.getByRole('button', { name: /Verify & Activate 2FA|Xác thực & Kích hoạt 2FA/i }),
    );

    // 8 Recovery codes should be displayed
    await waitFor(() => {
      expect(screen.getByText('A1B2-C3D4-E5')).toBeInTheDocument();
      expect(screen.getByText('M6N7-P8Q9-R0')).toBeInTheDocument();
      expect(screen.getByText(/Copy Codes|Sao chép mã/i)).toBeInTheDocument();
      expect(screen.getByText(/Download TXT|Tải file TXT/i)).toBeInTheDocument();
    });
  });
});
