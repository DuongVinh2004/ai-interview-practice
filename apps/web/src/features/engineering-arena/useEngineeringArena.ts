import { create } from 'zustand';
import { apiClient } from '../../lib/api-client';
import {
  ChallengeSummary,
  ChallengeDetail,
  ArenaSessionResponse,
  ArenaExecutionRunResponse,
  ArenaEvaluationResponse,
  ArenaAiAssistanceMode,
  ArenaSessionState,
} from '@ai-interview/contracts';

export interface EngineeringArenaState {
  challenges: ChallengeSummary[];
  activeChallenge: ChallengeDetail | null;
  session: ArenaSessionResponse | null;
  fileContents: Record<string, string>;
  activeFilePath: string | null;
  latestRun: ArenaExecutionRunResponse | null;
  evaluation: ArenaEvaluationResponse | null;
  isRunningCommand: boolean;
  isSubmitting: boolean;
  isAskingCopilot: boolean;
  isLoading: boolean;
  error: string | null;

  setChallenges: (challenges: ChallengeSummary[]) => void;
  setActiveChallenge: (challenge: ChallengeDetail | null) => void;
  setSession: (session: ArenaSessionResponse | null) => void;
  setFileContents: (fileContents: Record<string, string>) => void;
  updateFileContent: (path: string, content: string) => void;
  setActiveFilePath: (path: string | null) => void;
  setLatestRun: (run: ArenaExecutionRunResponse | null) => void;
  setEvaluation: (evalRes: ArenaEvaluationResponse | null) => void;
  resetSession: () => void;

  fetchChallenges: (filters?: { domain?: string; category?: string }) => Promise<void>;
  startSession: (
    challengeSlug: string,
    aiMode?: ArenaAiAssistanceMode,
  ) => Promise<ArenaSessionResponse>;
  runCommand: (commandId: string) => Promise<ArenaExecutionRunResponse | undefined>;
  submitSolution: (explanation?: string) => Promise<ArenaEvaluationResponse | undefined>;
  askCopilot: (
    userQuestion: string,
  ) => Promise<{ answer: string; mode: string; timestamp: string } | undefined>;
}

export const useEngineeringArena = create<EngineeringArenaState>((set, get) => ({
  challenges: [],
  activeChallenge: null,
  session: null,
  fileContents: {},
  activeFilePath: null,
  latestRun: null,
  evaluation: null,
  isRunningCommand: false,
  isSubmitting: false,
  isAskingCopilot: false,
  isLoading: false,
  error: null,

  setChallenges: challenges => set({ challenges }),
  setActiveChallenge: activeChallenge => set({ activeChallenge }),
  setSession: session => set({ session }),
  setFileContents: fileContents => set({ fileContents }),
  updateFileContent: (path, content) =>
    set(state => ({ fileContents: { ...state.fileContents, [path]: content } })),
  setActiveFilePath: activeFilePath => set({ activeFilePath }),
  setLatestRun: latestRun => set({ latestRun }),
  setEvaluation: evaluation => set({ evaluation }),
  resetSession: () =>
    set({
      session: null,
      fileContents: {},
      activeFilePath: null,
      latestRun: null,
      evaluation: null,
      error: null,
      isLoading: false,
    }),

  fetchChallenges: async filters => {
    set({ isLoading: true, error: null });
    try {
      const queryParams = new URLSearchParams();
      if (filters?.domain) queryParams.set('domain', filters.domain);
      if (filters?.category) queryParams.set('category', filters.category);

      const res = await apiClient.get<ChallengeSummary[]>(
        `/arena/challenges${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      );
      set({ challenges: res.data });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch challenges' });
    } finally {
      set({ isLoading: false });
    }
  },

  startSession: async (challengeSlug, aiMode = ArenaAiAssistanceMode.HINTS_ONLY) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.post<ArenaSessionResponse>('/arena/sessions', {
        challengeSlug,
        aiAssistanceMode: aiMode,
      });

      const firstEditable = res.data.files.find(f => f.isEditable);
      const initialActivePath = firstEditable
        ? firstEditable.path
        : res.data.files[0]?.path || null;

      set({
        session: res.data,
        fileContents: res.data.initialFileContents || {},
        activeFilePath: initialActivePath,
        latestRun: null,
        evaluation: null,
      });

      return res.data;
    } catch (err: any) {
      set({ error: err.message || 'Failed to start Arena session' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  runCommand: async commandId => {
    const { session, fileContents } = get();
    if (!session) return;
    set({ isRunningCommand: true, error: null });
    try {
      const modifiedFiles = Object.entries(fileContents).map(([path, content]) => ({
        path,
        content,
      }));
      const res = await apiClient.post<ArenaExecutionRunResponse>(
        `/arena/sessions/${session.id}/run`,
        {
          commandId,
          modifiedFiles,
        },
      );
      set({ latestRun: res.data });
      return res.data;
    } catch (err: any) {
      set({ error: err.message || 'Execution failed' });
      throw err;
    } finally {
      set({ isRunningCommand: false });
    }
  },

  submitSolution: async explanation => {
    const { session, fileContents } = get();
    if (!session) return;
    if (session.state === ArenaSessionState.COMPLETED) {
      return get().evaluation ?? undefined;
    }
    set({ isSubmitting: true, error: null });
    try {
      const finalFiles = Object.entries(fileContents).map(([path, content]) => ({
        path,
        content,
      }));
      const res = await apiClient.post<ArenaEvaluationResponse>(
        `/arena/sessions/${session.id}/submit`,
        {
          explanation,
          finalFiles,
        },
      );
      set({
        evaluation: res.data,
        session: {
          ...session,
          state: ArenaSessionState.COMPLETED,
          completedAt: new Date().toISOString(),
        },
      });
      return res.data;
    } catch (err: any) {
      set({ error: err.message || 'Submission failed' });
      throw err;
    } finally {
      set({ isSubmitting: false });
    }
  },

  askCopilot: async userQuestion => {
    const { session, activeFilePath, fileContents, latestRun } = get();
    if (!session) return;
    set({ isAskingCopilot: true, error: null });
    try {
      const res = await apiClient.post<{ answer: string; mode: string; timestamp: string }>(
        '/arena/copilot/ask',
        {
          sessionId: session.id,
          userQuestion,
          activeFilePath: activeFilePath || undefined,
          activeFileContent: activeFilePath ? fileContents[activeFilePath] : undefined,
          latestErrorLog: latestRun?.stderr || undefined,
        },
      );
      return res.data;
    } catch (err: any) {
      set({ error: err.message || 'Failed to get guidance from AI Copilot' });
      throw err;
    } finally {
      set({ isAskingCopilot: false });
    }
  },
}));
