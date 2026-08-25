import { AudioVoice } from '@ai-interview/contracts';

export interface AudioSttResult {
  text: string;
  confidence: number;
  durationSeconds?: number;
  detectedLanguage?: string;
  provider: string;
  model: string;
  latencyMs: number;
  costEstimate?: number;
}

export interface AudioTtsResult {
  audioBuffer: Buffer;
  mimeType: string;
  durationSeconds?: number;
  provider: string;
  model: string;
  latencyMs: number;
  costEstimate?: number;
}

export interface AudioProviderInterface {
  readonly name: string;

  transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    filename?: string,
    language?: string,
  ): Promise<AudioSttResult>;

  synthesize(text: string, voice?: AudioVoice, speed?: number): Promise<AudioTtsResult>;
}
