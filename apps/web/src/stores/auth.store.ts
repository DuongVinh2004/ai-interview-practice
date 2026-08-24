import { create } from 'zustand';
import { UserDto } from '@ai-interview/contracts';

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

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  accessToken: getStoredToken('access_token'),
  refreshToken: getStoredToken('refresh_token'),
  isAuthenticated: !!getStoredToken('access_token'),

  setAuth: (user, accessToken, refreshToken) => {
    safeSetItem('access_token', accessToken);
    safeSetItem('refresh_token', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  setUser: user => {
    set({ user });
  },

  setAccessToken: accessToken => {
    safeSetItem('access_token', accessToken);
    set({ accessToken, isAuthenticated: true });
  },

  logout: () => {
    safeRemoveItem('access_token');
    safeRemoveItem('refresh_token');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },
}));
