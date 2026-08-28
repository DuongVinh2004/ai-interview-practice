import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../stores/auth.store';
import {
  JdAnalysisDto,
  InterviewBlueprintDto,
  ParseCvRequest,
  AnalyzeJdRequest,
  GenerateBlueprintRequest,
  CvParseResponse,
} from '@ai-interview/contracts';

export function useDocumentParser() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore(state => state.accessToken);

  const parseCvMutation = useMutation({
    mutationFn: async (data: { file?: File; text?: string; fileName?: string }) => {
      if (data.file) {
        const formData = new FormData();
        formData.append('file', data.file);
        const res = await apiClient.post<CvParseResponse>('/documents/parse-cv', formData);
        return res.data;
      } else {
        const payload: ParseCvRequest = {
          fileName: data.fileName || 'resume.txt',
          fileType: 'text',
          rawText: data.text || '',
        };
        const res = await apiClient.post<CvParseResponse>('/documents/parse-cv', payload);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'my-profiles'] });
    },
  });

  const analyzeJdMutation = useMutation({
    mutationFn: async (payload: AnalyzeJdRequest) => {
      const res = await apiClient.post<JdAnalysisDto>('/documents/analyze-jd', payload);
      return res.data;
    },
  });

  const generateBlueprintMutation = useMutation({
    mutationFn: async (payload: GenerateBlueprintRequest) => {
      const res = await apiClient.post<InterviewBlueprintDto>(
        '/documents/generate-blueprint',
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'my-blueprints'] });
    },
  });

  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['documents', 'my-profiles'],
    queryFn: async () => {
      const res = await apiClient.get<any[]>('/documents/my-profiles');
      return res.data;
    },
    enabled: !!accessToken,
    retry: false,
  });

  const { data: blueprints, isLoading: isLoadingBlueprints } = useQuery({
    queryKey: ['documents', 'my-blueprints'],
    queryFn: async () => {
      const res = await apiClient.get<InterviewBlueprintDto[]>('/documents/my-blueprints');
      return res.data;
    },
    enabled: !!accessToken,
    retry: false,
  });

  return {
    parseCv: parseCvMutation.mutateAsync,
    isParsingCv: parseCvMutation.isPending,
    cvError: parseCvMutation.error,
    analyzeJd: analyzeJdMutation.mutateAsync,
    isAnalyzingJd: analyzeJdMutation.isPending,
    jdError: analyzeJdMutation.error,
    generateBlueprint: generateBlueprintMutation.mutateAsync,
    isGeneratingBlueprint: generateBlueprintMutation.isPending,
    blueprintError: generateBlueprintMutation.error,
    profiles,
    isLoadingProfiles,
    blueprints,
    isLoadingBlueprints,
  };
}
