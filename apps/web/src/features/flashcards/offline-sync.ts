import { FSRSRating } from '@ai-interview/contracts';

export const OFFLINE_REVIEWS_STORAGE_KEY = 'offline_flashcard_reviews';

export interface QueuedOfflineReview {
  cardId: string;
  rating: FSRSRating;
  durationMs: number;
  queuedAt: number;
}

// In-memory fallback if localStorage is unavailable or throws in test environment
const memoryFallback = new Map<string, string>();

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.getItem('__probe__');
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem('__probe__');
      return localStorage;
    }
  } catch {
    // Fallback to memory
  }

  return {
    getItem: (k: string) => memoryFallback.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoryFallback.set(k, v);
    },
    removeItem: (k: string) => {
      memoryFallback.delete(k);
    },
    clear: () => {
      memoryFallback.clear();
    },
  };
}

export function getOfflineReviews(): QueuedOfflineReview[] {
  try {
    const storage = getStorage();
    const raw = storage.getItem(OFFLINE_REVIEWS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function queueOfflineReview(review: {
  cardId: string;
  rating: FSRSRating;
  durationMs?: number;
}): void {
  try {
    const storage = getStorage();
    const current = getOfflineReviews();
    current.push({
      cardId: review.cardId,
      rating: review.rating,
      durationMs: review.durationMs ?? 0,
      queuedAt: Date.now(),
    });
    storage.setItem(OFFLINE_REVIEWS_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save offline flashcard review:', err);
  }
}

export function clearOfflineReviews(): void {
  try {
    const storage = getStorage();
    storage.removeItem(OFFLINE_REVIEWS_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear offline flashcard reviews:', err);
  }
}

export async function syncOfflineReviews(
  syncFn: (item: { cardId: string; rating: FSRSRating; durationMs: number }) => Promise<any>,
): Promise<{ synced: number; failed: number }> {
  const reviews = getOfflineReviews();
  if (reviews.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  const remaining: QueuedOfflineReview[] = [];

  for (const review of reviews) {
    try {
      await syncFn({
        cardId: review.cardId,
        rating: review.rating,
        durationMs: review.durationMs,
      });
      synced++;
    } catch {
      remaining.push(review);
    }
  }

  try {
    const storage = getStorage();
    if (remaining.length === 0) {
      storage.removeItem(OFFLINE_REVIEWS_STORAGE_KEY);
    } else {
      storage.setItem(OFFLINE_REVIEWS_STORAGE_KEY, JSON.stringify(remaining));
    }
  } catch (err) {
    console.error('Failed to update offline review queue:', err);
  }

  return { synced, failed: remaining.length };
}

/**
 * Automatically syncs queued offline reviews when the browser reconnects.
 * Returns a cleanup function to unregister the online event listener.
 */
export function setupOfflineAutoSync(
  syncFn: (item: { cardId: string; rating: FSRSRating; durationMs: number }) => Promise<any>,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    syncOfflineReviews(syncFn).catch(err => {
      console.error('Failed to auto-sync offline reviews on reconnect:', err);
    });
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
