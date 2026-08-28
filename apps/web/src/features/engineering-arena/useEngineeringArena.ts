import { useState, useCallback } from 'react';
import { apiClient } from '../../lib/api-client';
import {
  ChallengeSummary,
  ChallengeDetail,
  ArenaSessionResponse,
  ArenaExecutionRunResponse,
  ArenaEvaluationResponse,
  ArenaAiAssistanceMode,
} from '@ai-interview/contracts';

export function useEngineeringArena() {
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeDetail | null>(null);
  const [session, setSession] = useState<ArenaSessionResponse | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<ArenaExecutionRunResponse | null>(null);
  const [evaluation, setEvaluation] = useState<ArenaEvaluationResponse | null>(null);
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChallenges = useCallback(async (filters?: { domain?: string; category?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters?.domain) queryParams.set('domain', filters.domain);
      if (filters?.category) queryParams.set('category', filters.category);

      const res = await apiClient.get<ChallengeSummary[]>(
        `/arena/challenges${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      );
      setChallenges(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch challenges');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startSession = useCallback(
    async (challengeSlug: string, aiMode = ArenaAiAssistanceMode.HINTS_ONLY) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient.post<ArenaSessionResponse>('/arena/sessions', {
          challengeSlug,
          aiAssistanceMode: aiMode,
        });
        setSession(res.data);
        setFileContents(res.data.initialFileContents || {});

        const firstEditable = res.data.files.find((f) => f.isEditable);
        const initialActivePath = firstEditable ? firstEditable.path : res.data.files[0]?.path || null;
        setActiveFilePath(initialActivePath);

        return res.data;
      } catch (err: any) {
        setError(err.message || 'Failed to start Arena session');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const updateFileContent = useCallback((path: string, content: string) => {
    setFileContents((prev) => ({ ...prev, [path]: content }));
  }, []);

  const runCommand = useCallback(
    async (commandId: string) => {
      if (!session) return;
      setIsRunningCommand(true);
      setError(null);
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
        setLatestRun(res.data);
        return res.data;
      } catch (err: any) {
        setError(err.message || 'Execution failed');
        throw err;
      } finally {
        setIsRunningCommand(false);
      }
    },
    [session, fileContents],
  );

  const submitSolution = useCallback(
    async (explanation?: string) => {
      if (!session) return;
      setIsSubmitting(true);
      setError(null);
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
        setEvaluation(res.data);
        return res.data;
      } catch (err: any) {
        setError(err.message || 'Submission failed');
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [session, fileContents],
  );

  const [isAskingCopilot, setIsAskingCopilot] = useState(false);

  const askCopilot = useCallback(
    async (userQuestion: string) => {
      if (!session) return;
      setIsAskingCopilot(true);
      setError(null);
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
        setError(err.message || 'Failed to get guidance from AI Copilot');
        throw err;
      } finally {
        setIsAskingCopilot(false);
      }
    },
    [session, activeFilePath, fileContents, latestRun],
  );

  return {
    challenges,
    activeChallenge,
    setActiveChallenge,
    session,
    fileContents,
    activeFilePath,
    latestRun,
    evaluation,
    isRunningCommand,
    isSubmitting,
    isAskingCopilot,
    isLoading,
    error,
    fetchChallenges,
    startSession,
    updateFileContent,
    setActiveFilePath,
    runCommand,
    submitSolution,
    askCopilot,
  };
}

