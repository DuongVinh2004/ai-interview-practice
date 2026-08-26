import { create } from 'zustand';
import { UserDto } from '@ai-interview/contracts';
import { clearClientCaches } from '../lib/query-client';

interface AuthState {
  user: UserDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: UserDto, accessToken: string, refreshToken: string) => void;
  setUser: (user: UserDto) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
}

const getStoredToken = (key: string): string | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
};

const safeSetItem = (key: string, val: string) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(key, val);
    } catch {
      // ignore storage write errors
    }
  }
};

const safeRemoveItem = (key: string) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage removal errors
    }
  }
};

const getStoredUser = (): UserDto | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  accessToken: getStoredToken('access_token'),
  refreshToken: getStoredToken('refresh_token'),
  isAuthenticated: !!getStoredToken('access_token'),

  setAuth: (user, accessToken, refreshToken) => {
    const currentUser = get().user;
    if (currentUser && currentUser.id !== user.id) {
      // Switched accounts: purge prior user queries and caches immediately (PRIV-001)
      clearClientCaches();
    }
    safeSetItem('access_token', accessToken);
    safeSetItem('refresh_token', refreshToken);
    safeSetItem('auth_user', JSON.stringify(user));
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  setUser: user => {
    safeSetItem('auth_user', JSON.stringify(user));
    set({ user });
  },

  setAccessToken: accessToken => {
    safeSetItem('access_token', accessToken);
    set({ accessToken, isAuthenticated: true });
  },

  logout: async () => {
    const currentRefreshToken = get().refreshToken;
    const currentAccessToken = get().accessToken;

    if (currentRefreshToken || currentAccessToken) {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentAccessToken ? { Authorization: `Bearer ${currentAccessToken}` } : {}),
          },
          body: JSON.stringify({ refreshToken: currentRefreshToken || undefined }),
        });
      } catch (err) {
        console.warn('Backend logout revocation error:', err);
      }
    }

    // Purge query cache, user storage, and service worker caches (PRIV-001)
    clearClientCaches();
    safeRemoveItem('access_token');
    safeRemoveItem('refresh_token');
    safeRemoveItem('auth_user');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },
}));
