import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlashcardReviewPage } from '../features/flashcards/FlashcardReviewPage';
import { CardType, FSRSRating } from '@ai-interview/contracts';
import {
  getOfflineReviews,
  queueOfflineReview,
  clearOfflineReviews,
  syncOfflineReviews,
  setupOfflineAutoSync,
} from '../features/flashcards/offline-sync';
import * as useFlashcardsModule from '../hooks/useFlashcards';

describe('Offline Flashcard Review Flow (Plan C4 - Task 2)', () => {
  let queryClient: QueryClient;
  const originalOnLine = navigator.onLine;

  const mockCachedCards = [
    {
      id: 'card-offline-1',
      deckId: 'deck-1',
      frontContent: 'What is Eventual Consistency?',
      backContent:
        'A consistency model used in distributed systems where updates eventually propagate.',
      type: CardType.CONCEPT,
      state: 0,
      step: 0,
    },
    {
      id: 'card-offline-2',
      deckId: 'deck-1',
      frontContent: 'What is Database Sharding?',
      backContent: 'Horizontal partitioning of data across multiple database instances.',
      type: CardType.SCENARIO,
      state: 0,
      step: 0,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    clearOfflineReviews();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
      writable: true,
    });
    clearOfflineReviews();
  });

  it('renders cached flashcard data and displays offline indicator when navigator.onLine is false', () => {
    // Mock offline
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    // Mock useFlashcards returning cached data
    const mockReviewCard = vi.fn().mockResolvedValue({});
    vi.spyOn(useFlashcardsModule, 'useFlashcards').mockReturnValue({
      dueCards: mockCachedCards,
      isLoadingDue: false,
      refetchDue: vi.fn(),
      decks: [],
      isLoadingDecks: false,
      refetchDecks: vi.fn(),
      stats: undefined,
      isLoadingStats: false,
      refetchStats: vi.fn(),
      createDeck: vi.fn(),
      isCreatingDeck: false,
      deleteDeck: vi.fn(),
      createCard: vi.fn(),
      isCreatingCard: false,
      reviewCard: mockReviewCard,
      isReviewingCard: false,
      autoGenerateCards: vi.fn(),
      isAutoGenerating: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FlashcardReviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Assert cached flashcard renders
    expect(screen.getByText('What is Eventual Consistency?')).toBeInTheDocument();

    // Assert offline indicator is visible
    const indicator = screen.getByTestId('offline-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toContain('Đang offline — học từ bộ nhớ đệm');
  });

  it('queues review when rating card while offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    const mockReviewCard = vi.fn().mockRejectedValue(new Error('Network error: Failed to fetch'));
    vi.spyOn(useFlashcardsModule, 'useFlashcards').mockReturnValue({
      dueCards: mockCachedCards,
      isLoadingDue: false,
      refetchDue: vi.fn(),
      decks: [],
      isLoadingDecks: false,
      refetchDecks: vi.fn(),
      stats: undefined,
      isLoadingStats: false,
      refetchStats: vi.fn(),
      createDeck: vi.fn(),
      isCreatingDeck: false,
      deleteDeck: vi.fn(),
      createCard: vi.fn(),
      isCreatingCard: false,
      reviewCard: mockReviewCard,
      isReviewingCard: false,
      autoGenerateCards: vi.fn(),
      isAutoGenerating: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FlashcardReviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Tap card to flip
    const cardElement = screen.getByTestId('swipe-card');
    fireEvent.click(cardElement);

    // Card shows back content
    expect(screen.getByText(/A consistency model used in distributed systems/)).toBeInTheDocument();

    // Rate Good (rating 3)
    const goodButton = screen.getByText(/3\. Tốt/);
    fireEvent.click(goodButton);

    // Verify review was queued
    const queued = getOfflineReviews();
    expect(queued.length).toBe(1);
    expect(queued[0].cardId).toBe('card-offline-1');
    expect(queued[0].rating).toBe(FSRSRating.GOOD);

    // Verify next cached card rendered
    await waitFor(() => {
      expect(screen.getByText('What is Database Sharding?')).toBeInTheDocument();
    });
  });

  it('syncs offline reviews when network reconnects', async () => {
    // Seed queued offline reviews
    queueOfflineReview({
      cardId: 'card-offline-1',
      rating: FSRSRating.GOOD,
      durationMs: 1200,
    });
    queueOfflineReview({
      cardId: 'card-offline-2',
      rating: FSRSRating.AGAIN,
      durationMs: 2500,
    });

    const mockSyncFn = vi.fn().mockResolvedValue({ success: true });
    const syncResult = await syncOfflineReviews(mockSyncFn);

    expect(syncResult.synced).toBe(2);
    expect(syncResult.failed).toBe(0);
    expect(mockSyncFn).toHaveBeenCalledTimes(2);
    expect(getOfflineReviews()).toEqual([]);
  });

  it('automatically syncs queued reviews when network online event fires', async () => {
    queueOfflineReview({
      cardId: 'card-offline-auto-1',
      rating: FSRSRating.GOOD,
      durationMs: 1000,
    });

    const mockSyncFn = vi.fn().mockResolvedValue({ success: true });
    const cleanup = setupOfflineAutoSync(mockSyncFn);

    // Simulate online event
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(mockSyncFn).toHaveBeenCalledWith({
        cardId: 'card-offline-auto-1',
        rating: FSRSRating.GOOD,
        durationMs: 1000,
      });
      expect(getOfflineReviews()).toEqual([]);
    });

    cleanup();
  });
});
