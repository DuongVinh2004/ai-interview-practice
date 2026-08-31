import { create } from 'zustand';
import { UserDto } from '@ai-interview/contracts';
import { clearClientCaches } from '../lib/query-client';

interface AuthState {
  user: UserDto | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isSessionRestoring: boolean;
  mfaEnrollmentRequired: boolean;
  setAuth: (user: UserDto, accessToken: string) => void;
  setMfaEnrollmentAuth: (user: UserDto, accessToken: string) => void;
  setUser: (user: UserDto) => void;
  setAccessToken: (accessToken: string) => void;
  restoreSession: () => Promise<void>;
  logout: () => void;
}

let sessionRestorePromise: Promise<void> | null = null;
let authStateVersion = 0;

const safeSetItem = (key: string, val: string) => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, val);
    } catch {
      // ignore storage write errors
    }
  }
};

const safeRemoveItem = (key: string) => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage removal errors
    }
  }
};

const getStoredUser = (): UserDto | null => {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  accessToken: null,
  isAuthenticated: false,
  isSessionRestoring: true,
  mfaEnrollmentRequired: false,

  setAuth: (user, accessToken) => {
    authStateVersion += 1;
    const currentUser = get().user;
    if (currentUser && currentUser.id !== user.id) {
      // Switched accounts: purge prior user queries and caches immediately (PRIV-001)
      clearClientCaches();
    }
    safeSetItem('auth_user', JSON.stringify(user));
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isSessionRestoring: false,
      mfaEnrollmentRequired: false,
    });
  },

  setMfaEnrollmentAuth: (user, accessToken) => {
    authStateVersion += 1;
    safeSetItem('auth_user', JSON.stringify(user));
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isSessionRestoring: false,
      mfaEnrollmentRequired: true,
    });
  },

  setUser: user => {
    safeSetItem('auth_user', JSON.stringify(user));
    set({ user });
  },

  setAccessToken: accessToken => {
    authStateVersion += 1;
    set({ accessToken, isAuthenticated: true });
  },

  restoreSession: async () => {
    if (!sessionRestorePromise) {
      const restoreVersion = authStateVersion;
      sessionRestorePromise = (async () => {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
          const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-CSRF-Protection': '1' },
          });
          if (!response.ok) {
            if (authStateVersion === restoreVersion) {
              set({
                user: null,
                accessToken: null,
                isAuthenticated: false,
                mfaEnrollmentRequired: false,
              });
              safeRemoveItem('auth_user');
            }
            return;
          }
          const body = await response.json();
          const payload = body.data || body;
          if (!payload.user || !payload.accessToken) throw new Error('Invalid refresh response');
          if (authStateVersion === restoreVersion) {
            get().setAuth(payload.user, payload.accessToken);
          }
        } catch {
          if (authStateVersion === restoreVersion) {
            set({
              user: null,
              accessToken: null,
              isAuthenticated: false,
              mfaEnrollmentRequired: false,
            });
            safeRemoveItem('auth_user');
          }
        } finally {
          set({ isSessionRestoring: false });
        }
      })();
    }

    const activeRestore = sessionRestorePromise;
    try {
      await activeRestore;
    } finally {
      if (sessionRestorePromise === activeRestore) {
        sessionRestorePromise = null;
      }
    }
  },

  logout: async () => {
    authStateVersion += 1;
    const currentAccessToken = get().accessToken;

    // Clear local auth state before best-effort server revocation. This immediately
    // stops protected queries from retrying with an expired or incomplete session.
    clearClientCaches();
    safeRemoveItem('auth_user');
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isSessionRestoring: false,
      mfaEnrollmentRequired: false,
    });

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'X-CSRF-Protection': '1',
          ...(currentAccessToken ? { Authorization: `Bearer ${currentAccessToken}` } : {}),
        },
        credentials: 'include',
      });
    } catch (err) {
      console.warn('Backend logout revocation error:', err);
    }
  },
}));
