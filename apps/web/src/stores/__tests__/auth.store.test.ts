import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole, UserStatus, type UserDto } from '@ai-interview/contracts';
import { useAuthStore } from '../auth.store';

const user: UserDto = {
  id: '264fb2c2-2fe2-48d4-8c3d-327011fb371e',
  email: 'candidate@example.com',
  role: UserRole.CANDIDATE,
  status: UserStatus.ACTIVE,
  mfaEnabled: false,
  createdAt: '2026-08-29T00:00:00.000Z',
  profile: {
    id: 'a54c0bee-22e8-48e5-924e-8585555f0ca7',
    fullName: 'Candidate',
  },
};

describe('auth store browser-token boundary', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
        removeItem: vi.fn((key: string) => storage.delete(key)),
        clear: vi.fn(() => storage.clear()),
      },
    });
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isSessionRestoring: true,
      mfaEnrollmentRequired: false,
    });
    vi.restoreAllMocks();
  });

  it('keeps the access token in memory and persists only non-secret user metadata', () => {
    useAuthStore.getState().setAuth(user, 'memory-only-access-token');

    expect(useAuthStore.getState().accessToken).toBe('memory-only-access-token');
    expect(storage.get('auth_user')).toContain('candidate@example.com');
    expect(storage.has('access_token')).toBe(false);
    expect(storage.has('refresh_token')).toBe(false);
    expect(useAuthStore.getState()).not.toHaveProperty('refreshToken');
  });

  it('tracks an MFA enrollment token separately from a normal authenticated session', () => {
    useAuthStore.getState().setMfaEnrollmentAuth(user, 'mfa-enrollment-token');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().mfaEnrollmentRequired).toBe(true);

    useAuthStore.getState().setAuth({ ...user, mfaEnabled: true }, 'verified-access-token');

    expect(useAuthStore.getState().mfaEnrollmentRequired).toBe(false);
    expect(useAuthStore.getState().accessToken).toBe('verified-access-token');
  });

  it('restores through the HttpOnly cookie without sending a token body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user, accessToken: 'rotated-access-token' } }),
    } as Response);

    await useAuthStore.getState().restoreSession();

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/auth\/refresh$/), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Protection': '1' },
    });
    expect(useAuthStore.getState().accessToken).toBe('rotated-access-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isSessionRestoring).toBe(false);
  });

  it('coalesces concurrent restore calls into one refresh-token rotation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user, accessToken: 'single-flight-access-token' } }),
    } as Response);

    await Promise.all([
      useAuthStore.getState().restoreSession(),
      useAuthStore.getState().restoreSession(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBe('single-flight-access-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('does not let a stale failed restore erase a newer login', async () => {
    let resolveRestore!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise<Response>(resolve => {
        resolveRestore = resolve;
      }),
    );

    const restore = useAuthStore.getState().restoreSession();
    useAuthStore.getState().setAuth(user, 'fresh-login-access-token');
    resolveRestore({ ok: false } as Response);
    await restore;

    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().accessToken).toBe('fresh-login-access-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(storage.get('auth_user')).toContain('candidate@example.com');
  });
});
