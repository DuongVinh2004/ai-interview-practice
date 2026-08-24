import { z } from 'zod';
import { AudioVoice, AudioProvider, InterviewMode } from '../enums';

export const TranscribeAudioResponseSchema = z.object({
  text: z.string().describe('Transcribed text from audio stream/file'),
  confidence: z.number().min(0).max(1).default(0.95),
  durationSeconds: z.number().min(0).optional(),
  detectedLanguage: z.string().optional(),
  provider: z.string().default('openai-whisper'),
});

export type TranscribeAudioResponse = z.infer<typeof TranscribeAudioResponseSchema>;

export const SynthesizeSpeechDtoSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Text to synthesize cannot be empty')
    .max(4096, 'Text exceeds maximum synthesis length of 4096 characters'),
  voice: z.nativeEnum(AudioVoice).default(AudioVoice.ALLOY).optional(),
  speed: z.number().min(0.25).max(4.0).default(1.0).optional(),
  provider: z.nativeEnum(AudioProvider).optional(),
});

export type SynthesizeSpeechDto = z.infer<typeof SynthesizeSpeechDtoSchema>;

export const SynthesizeSpeechResponseSchema = z.object({
  audioBase64: z.string().describe('Base64-encoded audio buffer (e.g. mp3 or wav)'),
  mimeType: z.string().default('audio/mpeg'),
  durationSeconds: z.number().min(0).optional(),
  provider: z.string().default('openai-tts'),
});

export type SynthesizeSpeechResponse = z.infer<typeof SynthesizeSpeechResponseSchema>;

export const AudioSettingsDtoSchema = z.object({
  mode: z.nativeEnum(InterviewMode).default(InterviewMode.TEXT),
  voice: z.nativeEnum(AudioVoice).default(AudioVoice.ALLOY),
  playbackSpeed: z.number().min(0.5).max(2.0).default(1.0),
  autoPlayTts: z.boolean().default(true),
  micSensitivity: z.number().min(0).max(100).default(80),
  pushToTalk: z.boolean().default(false),
});

export type AudioSettingsDto = z.infer<typeof AudioSettingsDtoSchema>;
