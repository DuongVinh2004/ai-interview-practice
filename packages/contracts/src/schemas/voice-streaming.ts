import { z } from 'zod';
import { VoiceSessionStatus, SpeakerRole } from '../enums/index';

export const VoiceConnectPayloadSchema = z.object({
  interviewId: z.string().uuid(),
  sampleRate: z.number().int().default(16000),
  codec: z.enum(['opus', 'pcm']).default('opus'),
});
export type VoiceConnectPayload = z.infer<typeof VoiceConnectPayloadSchema>;

export const TranscriptUpdateSchema = z.object({
  text: z.string(),
  isFinal: z.boolean().default(false),
  speaker: z.nativeEnum(SpeakerRole),
  startTimeMs: z.number().int(),
  endTimeMs: z.number().int(),
  turnNumber: z.number().int().optional(),
});
export type TranscriptUpdate = z.infer<typeof TranscriptUpdateSchema>;

export const ConnectionQualitySchema = z.object({
  latencyMs: z.number(),
  jitter: z.number().optional(),
  packetLoss: z.number().optional(),
  quality: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']),
});
export type ConnectionQuality = z.infer<typeof ConnectionQualitySchema>;

export const VoiceTranscriptDtoSchema = z.object({
  id: z.string().uuid(),
  voiceSessionId: z.string().uuid(),
  speaker: z.nativeEnum(SpeakerRole),
  text: z.string(),
  startTimeMs: z.number(),
  endTimeMs: z.number(),
  isFinal: z.boolean(),
  turnNumber: z.number().nullable().optional(),
  createdAt: z.string().or(z.date()),
});
export type VoiceTranscriptDto = z.infer<typeof VoiceTranscriptDtoSchema>;

export const VoiceSessionMetricDtoSchema = z.object({
  id: z.string().uuid(),
  voiceSessionId: z.string().uuid(),
  avgLatencyMs: z.number(),
  p95LatencyMs: z.number(),
  packetLossRate: z.number(),
  interruptions: z.number(),
  totalChunks: z.number(),
});
export type VoiceSessionMetricDto = z.infer<typeof VoiceSessionMetricDtoSchema>;

export const VoiceSessionDtoSchema = z.object({
  id: z.string().uuid(),
  interviewId: z.string().uuid(),
  status: z.nativeEnum(VoiceSessionStatus),
  startedAt: z.string().or(z.date()),
  endedAt: z.string().or(z.date()).nullable().optional(),
  audioUrl: z.string().nullable().optional(),
  totalDuration: z.number().nullable().optional(),
  createdAt: z.string().or(z.date()),
  transcripts: z.array(VoiceTranscriptDtoSchema).default([]),
  metrics: VoiceSessionMetricDtoSchema.nullable().optional(),
});
export type VoiceSessionDto = z.infer<typeof VoiceSessionDtoSchema>;
