import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  FlashcardDeckDto,
  FlashcardDto,
  FlashcardStatsDto,
  CreateDeckRequest,
  CreateFlashcardRequest,
  AutoGenerateFlashcardsRequest,
  FSRSRating,
} from '@ai-interview/contracts';

export function useFlashcards() {
  const queryClient = useQueryClient();

  // 1. Decks query
  const { data: decks = [], isLoading: isLoadingDecks, refetch: refetchDecks } = useQuery<FlashcardDeckDto[]>({
    queryKey: ['flashcards', 'decks'],
    queryFn: async () => {
      const res = await apiClient.get<FlashcardDeckDto[]>('/flashcards/decks');
      return res.data;
    },
  });

  // 2. Due cards query
  const { data: dueCards = [], isLoading: isLoadingDue, refetch: refetchDue } = useQuery<any[]>({
    queryKey: ['flashcards', 'due'],
    queryFn: async () => {
      const res = await apiClient.get<any[]>('/flashcards/due');
      return res.data;
    },
  });

  // 3. Stats query
  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery<FlashcardStatsDto>({
    queryKey: ['flashcards', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get<FlashcardStatsDto>('/flashcards/stats');
      return res.data;
    },
  });

  // 4. Mutations
  const createDeckMutation = useMutation({
    mutationFn: async (payload: CreateDeckRequest) => {
      const res = await apiClient.post<FlashcardDeckDto>('/flashcards/decks', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'decks'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'stats'] });
    },
  });

  const deleteDeckMutation = useMutation({
    mutationFn: async (deckId: string) => {
      const res = await apiClient.delete(`/flashcards/decks/${deckId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'decks'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'stats'] });
    },
  });

  const createCardMutation = useMutation({
    mutationFn: async (payload: CreateFlashcardRequest) => {
      const res = await apiClient.post<FlashcardDto>(`/flashcards/decks/${payload.deckId}/cards`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'decks'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'due'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'stats'] });
    },
  });

  const reviewCardMutation = useMutation({
    mutationFn: async ({ cardId, rating, durationMs }: { cardId: string; rating: FSRSRating; durationMs?: number }) => {
      const res = await apiClient.post(`/flashcards/${cardId}/review`, { rating, durationMs: durationMs || 0 });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'due'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'decks'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'stats'] });
    },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: async (payload: AutoGenerateFlashcardsRequest) => {
      const res = await apiClient.post('/flashcards/auto-generate', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'decks'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'due'] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'stats'] });
    },
  });

  return {
    decks,
    isLoadingDecks,
    refetchDecks,
    dueCards,
    isLoadingDue,
    refetchDue,
    stats,
    isLoadingStats,
    refetchStats,
    createDeck: createDeckMutation.mutateAsync,
    isCreatingDeck: createDeckMutation.isPending,
    deleteDeck: deleteDeckMutation.mutateAsync,
    createCard: createCardMutation.mutateAsync,
    isCreatingCard: createCardMutation.isPending,
    reviewCard: reviewCardMutation.mutateAsync,
    isReviewingCard: reviewCardMutation.isPending,
    autoGenerateCards: autoGenerateMutation.mutateAsync,
    isAutoGenerating: autoGenerateMutation.isPending,
  };
}
