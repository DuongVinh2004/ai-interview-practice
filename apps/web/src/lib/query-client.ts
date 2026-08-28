import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

/**
 * Purges all user-isolated query caches, storage, and service worker caches
 * upon logout or account switch (AG-PACKET-005 / PRIV-001).
 */
export function clearClientCaches(): void {
  try {
    queryClient.cancelQueries();
    queryClient.clear();
    queryClient.removeQueries();
  } catch {
    // ignore queryClient clear errors in non-standard test environments
  }

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.clear();

      // Clean all user-scoped cached keys in localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('auth_') ||
            key.startsWith('user_') ||
            key.startsWith('interview_') ||
            key.startsWith('draft-answer-') ||
            key.startsWith('transcript_') ||
            key.startsWith('whiteboard_') ||
            key.startsWith('analytics_') ||
            key.startsWith('cache_') ||
            key === 'access_token' ||
            key === 'refresh_token' ||
            key === 'auth_user')
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // ignore storage cleanup errors
    }

    // Purge dynamic PWA / CacheStorage entries
    if ('caches' in window) {
      try {
        caches
          .keys()
          .then(keys => {
            keys.forEach(key => {
              if (!key.includes('google-fonts') && !key.includes('workbox-precache')) {
                caches.delete(key);
              }
            });
          })
          .catch(() => {});
      } catch {
        // ignore caches access error
      }
    }
  }
}
