import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryClient, clearClientCaches } from '../lib/query-client';
import { useAuthStore } from '../stores/auth.store';
import { UserRole, UserStatus, UserDto } from '@ai-interview/contracts';

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
};

describe('Query and Client Storage Cache Isolation (AG-PACKET-005 / PRIV-001)', () => {
  let mockLocalStorage: any;
  let mockSessionStorage: any;
  let deletedCaches: string[] = [];

  beforeEach(() => {
    mockLocalStorage = createStorageMock();
    mockSessionStorage = createStorageMock();
    deletedCaches = [];

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });

    // Mock CacheStorage
    const mockCaches = {
      keys: vi.fn().mockResolvedValue(['api-flashcards-cache', 'user-cache', 'google-fonts-cache']),
      delete: vi.fn((key: string) => {
        deletedCaches.push(key);
        return Promise.resolve(true);
      }),
    };
    Object.defineProperty(window, 'caches', {
      value: mockCaches,
      writable: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Logged out successfully' }),
    });

    queryClient.clear();
  });

  it('purges query client data and user-scoped storage upon clearClientCaches()', async () => {
    queryClient.setQueryData(['interview', 'int-123'], { transcript: 'Confidential transcript' });
    queryClient.setQueryData(['user', 'profile'], { fullName: 'Alice' });

    expect(queryClient.getQueryData(['interview', 'int-123'])).toBeDefined();

    window.localStorage.setItem('access_token', 'jwt.token.alice');
    window.localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 'alice-id', email: 'alice@example.com' }),
    );
    window.localStorage.setItem('interview_audio_cache', 'binary-data');
    window.localStorage.setItem('transcript_draft', 'my answers');
    window.localStorage.setItem('unrelated_theme_key', 'dark');

    window.sessionStorage.setItem('temp_session_key', 'temp-val');

    clearClientCaches();

    // QueryClient must be empty
    expect(queryClient.getQueryData(['interview', 'int-123'])).toBeUndefined();
    expect(queryClient.getQueryData(['user', 'profile'])).toBeUndefined();

    // User-specific storage must be purged
    expect(window.localStorage.getItem('access_token')).toBeNull();
    expect(window.localStorage.getItem('auth_user')).toBeNull();
    expect(window.localStorage.getItem('interview_audio_cache')).toBeNull();
    expect(window.localStorage.getItem('transcript_draft')).toBeNull();
    expect(window.sessionStorage.getItem('temp_session_key')).toBeNull();

    // Unrelated general setting is preserved
    expect(window.localStorage.getItem('unrelated_theme_key')).toBe('dark');

    // CacheStorage non-static caches are deleted
    await new Promise(r => setTimeout(r, 10));
    expect(deletedCaches).toContain('api-flashcards-cache');
    expect(deletedCaches).toContain('user-cache');
    expect(deletedCaches).not.toContain('google-fonts-cache');
  });

  it('triggers full cache purge when user logs out via useAuthStore.logout()', async () => {
    const user: UserDto = {
      id: 'user-1',
      email: 'user1@example.com',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
    };

    useAuthStore.getState().setAuth(user, 'token-1');
    queryClient.setQueryData(['interviews', 'user-1'], [{ id: 'int-1' }]);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(queryClient.getQueryData(['interviews', 'user-1'])).toBeDefined();

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(queryClient.getQueryData(['interviews', 'user-1'])).toBeUndefined();
  });

  it('triggers cache purge when switching accounts via setAuth() with a new user ID', () => {
    const userA: UserDto = {
      id: 'user-a',
      email: 'a@example.com',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
    };

    const userB: UserDto = {
      id: 'user-b',
      email: 'b@example.com',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
    };

    useAuthStore.getState().setAuth(userA, 'token-a');
    queryClient.setQueryData(['interview', 'user-a-data'], { secret: 'user A secret' });
    expect(queryClient.getQueryData(['interview', 'user-a-data'])).toBeDefined();

    // Switch account to User B
    useAuthStore.getState().setAuth(userB, 'token-b');

    // Prior user A data is immediately purged from QueryClient
    expect(queryClient.getQueryData(['interview', 'user-a-data'])).toBeUndefined();
    expect(useAuthStore.getState().user?.id).toBe('user-b');
  });
});
